#!/usr/bin/env python3
"""Frame-locked audio stems from the shared project contract. Never renders video."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import numpy as np
except ImportError:
    raise SystemExit("Audio mixing needs numpy: python -m pip install -r kit/audio/requirements.txt")

SR = 48000
BUSES = ("foley", "accents", "reactions", "ambience")
STEMS = ("voice", "music", *BUSES)
REPO = Path(__file__).resolve().parents[2]
DEFAULT_CATALOG = REPO / "assets/sfx/catalog.json"


class AudioError(ValueError):
    """An actionable input or cache error."""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def finite(value: Any, label: str, low: float | None = None, high: float | None = None) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise AudioError(f"{label} must be a finite number")
    if (low is not None and value < low) or (high is not None and value > high):
        raise AudioError(f"{label} must be between {low} and {high}")
    return float(value)


def integer(value: Any, label: str, low: int, high: int | None = None) -> int:
    finite(value, label, low, high)
    if not isinstance(value, int):
        raise AudioError(f"{label} must be an integer")
    return value


def object_value(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AudioError(f"{label} must be a JSON object")
    return value


def array_value(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise AudioError(f"{label} must be a JSON array")
    return value


def string_value(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise AudioError(f"{label} must be a nonempty string")
    return value


def frame_sample(frame: float, fps: float) -> int:
    # Positive half-up rounding matches JavaScript's Math.round, including odd fps.
    return math.floor(frame * SR / fps + .5)


def db_gain(db: float) -> float:
    return 10 ** (db / 20)


def db_peak(x: np.ndarray) -> float | None:
    peak = float(np.max(np.abs(x))) if x.size else 0
    return round(20 * math.log10(peak), 4) if peak else None


def command(args: list[str]) -> bytes:
    try:
        result = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        raise AudioError(f"Missing {args[0]}; install ffmpeg and ffprobe on PATH") from None
    except subprocess.CalledProcessError as error:
        raise AudioError(f"{args[0]} failed: {error.stderr.decode(errors='replace')[-1200:]}") from None
    return result.stdout


def probe(path: Path) -> dict[str, Any]:
    data = json.loads(command(["ffprobe", "-v", "error", "-select_streams", "a:0",
                               "-show_entries", "stream=channels,duration:format=duration",
                               "-of", "json", str(path)]))
    if not data.get("streams"):
        raise AudioError(f"No audio stream: {path}")
    stream = data["streams"][0]
    return {"channels": int(stream["channels"]),
            "durationSeconds": float(stream.get("duration", data.get("format", {}).get("duration", 0)))}


def read(path: Path, channels: int = 1) -> np.ndarray:
    raw = command(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
                   "-f", "f32le", "-ar", str(SR), "-ac", str(channels), "pipe:1"])
    result = np.frombuffer(raw, dtype="<f4").reshape(-1, channels).copy()
    if not len(result) or not np.all(np.isfinite(result)):
        raise AudioError(f"Empty or non-finite decoded audio: {path}")
    return result


def stereo_unity(path: Path) -> np.ndarray:
    channels = probe(path)["channels"]
    if channels not in (1, 2):
        raise AudioError(f"Use a mono or stereo input, not {channels} channels: {path}")
    x = read(path, channels)
    # Explicit dual mono preserves amplitude; implicit ffmpeg -ac 2 can lower mono by 3 dB.
    return np.repeat(x, 2, axis=1) if channels == 1 else x


def save_float_wav(path: Path, x: np.ndarray) -> None:
    """IEEE float WAV avoids gain changes and quantization of the unity voice stem."""
    if x.ndim != 2 or x.shape[1] != 2 or not np.all(np.isfinite(x)):
        raise AudioError(f"Invalid stereo stem: {path.name}")
    pcm = np.asarray(x, dtype="<f4").tobytes()
    fmt = struct.pack("<HHIIHH", 3, 2, SR, SR * 8, 8, 32)
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt "
    header += struct.pack("<I", 16) + fmt + b"data" + struct.pack("<I", len(pcm))
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(header + pcm)
    temporary.replace(path)


def edge(x: np.ndarray, attack: float = .003, release: float = .035) -> np.ndarray:
    x = x.copy()
    a, r = min(len(x), round(attack * SR)), min(len(x), round(release * SR))
    if a:
        x[:a] *= np.linspace(0, 1, a, dtype=np.float32)
    if r:
        x[-r:] *= np.linspace(1, 0, r, dtype=np.float32)
    return x


def color(x: np.ndarray, low: float = 60, high: float = 10000, carve: float = 0) -> np.ndarray:
    f = np.fft.rfftfreq(len(x), 1 / SR)
    gain = (f / np.sqrt(f * f + low * low)) / np.sqrt(1 + (f / high) ** 4)
    if carve:
        gain *= 1 - carve * np.exp(-.5 * (np.log2(np.maximum(f, 1) / 1600) / .95) ** 2)
    return np.fft.irfft(np.fft.rfft(x) * gain, n=len(x)).astype(np.float32)


def procedural(kind: str, duration: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(max(2, round(duration * SR)), dtype=np.float32) / SR
    noise = lambda high, low=60: color(rng.standard_normal(len(t)).astype(np.float32), low, high)
    if kind == "weight":
        x = np.sin(2 * np.pi * (75 * t + .77 * (1 - np.exp(-t / .035)))) * np.exp(-t * 15)
    elif kind in ("pop", "chime", "shock"):
        start, end = {"pop": (850, 290), "chime": (650, 1000), "shock": (1175, 720)}[kind]
        phase = 2 * np.pi * (start * t + (end - start) * t * t / (2 * duration))
        x = (np.sin(phase) + .18 * np.sin(phase * 1.498)) * np.exp(-t * (18 if kind == "pop" else 9))
    elif kind == "whoosh":
        x = noise(3900, 180) * np.sin(np.pi * np.minimum(t / duration, 1)) ** 2
    elif kind in ("wind", "water", "fire"):
        x = noise({"wind": 750, "water": 2000, "fire": 2700}[kind], 40)
        x *= .6 + .2 * np.sin(t * .63) + .14 * np.sin(t * 1.71)
        if kind == "fire":
            x += (rng.random(len(t)) > .999) * noise(8500, 400) * 2
    else:
        raise AudioError(f"Unknown procedural sound: {kind}")
    return edge(np.asarray(x, np.float32), min(.008, duration / 10), min(.08, duration / 4))


def load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise AudioError(f"Cannot read JSON {path}: {error}") from None
    if not isinstance(data, dict):
        raise AudioError(f"Expected a JSON object: {path}")
    return data


def resolve_asset(catalog: dict[str, Any], name: str, variant: int, seed: int) -> tuple[str, dict[str, Any], float]:
    string_value(name, "sound.asset")
    choices = catalog.get("aliases", {}).get(name, [name])
    if not isinstance(choices, list) or not choices:
        raise AudioError(f"Empty sound alias: {name}")
    index = variant if variant is not None else seed
    asset_id = choices[index % len(choices)]
    try:
        asset = catalog["assets"][asset_id]
    except KeyError:
        raise AudioError(f"Unknown sound asset: {name} ({asset_id})") from None
    asset_shape(asset, asset_id)
    rates = asset.get("pitchVariants", [1])
    if not isinstance(rates, list) or not rates:
        raise AudioError(f"{asset_id}: pitchVariants must not be empty")
    rate = finite(rates[(index // len(choices)) % len(rates)], f"{asset_id}.pitchVariants", .5, 2)
    return asset_id, asset, rate


def catalog_shape(catalog: dict[str, Any]) -> None:
    if catalog.get("version") != 1 or not isinstance(catalog.get("assets"), dict):
        raise AudioError("Audio catalog must have version: 1 and assets: {}")
    aliases = object_value(catalog.get("aliases", {}), "catalog.aliases")
    for name, choices in aliases.items():
        array_value(choices, f"catalog.aliases.{name}")
        if not choices or any(not isinstance(choice, str) or choice not in catalog["assets"] for choice in choices):
            raise AudioError(f"Broken catalog alias: {name}")


def asset_shape(asset: Any, name: str) -> None:
    object_value(asset, f"catalog.assets.{name}")
    kind = asset.get("kind", "recording")
    if kind == "procedural":
        if asset.get("generator") not in ("whoosh", "pop", "chime", "weight", "shock", "wind", "water", "fire"):
            raise AudioError(f"Unknown generator in catalog: {name}")
    elif kind == "recording":
        string_value(asset.get("path"), f"{name}.path")
        if asset.get("license") != "CC0-1.0" or not asset.get("sourceUrl"):
            raise AudioError(f"Bundled recording needs a CC0 ledger and source URL: {name}")
        trim = object_value(asset.get("trim", {}), f"{name}.trim")
        start = finite(trim.get("startSeconds", 0), f"{name}.trim.startSeconds", 0)
        if "endSeconds" in trim and finite(trim["endSeconds"], f"{name}.trim.endSeconds", 0) <= start:
            raise AudioError(f"{name}: trim end must follow trim start")
    else:
        raise AudioError(f"{name}: kind must be recording or procedural")
    finite(asset.get("targetPeakDbfs", -14), f"{name}.targetPeakDbfs", -80, 0)
    finite(asset.get("gainDb", 0), f"{name}.gainDb", -80, 24)
    rates = array_value(asset.get("pitchVariants", [1]), f"{name}.pitchVariants")
    if not rates:
        raise AudioError(f"{name}.pitchVariants must not be empty")
    for rate in rates:
        finite(rate, f"{name}.pitchVariants", .5, 2)
    for field, default in (("attackSeconds", .003), ("releaseSeconds", .035), ("peakOffsetSeconds", 0)):
        finite(asset.get(field, default), f"{name}.{field}", 0)
    finite(asset.get("attackWindowSeconds", .18), f"{name}.attackWindowSeconds", .001)
    finite(asset.get("durationSeconds", .3), f"{name}.durationSeconds", .001)


def verify_file(path: Path, expected: str | None, label: str, require_hash: bool = True) -> str:
    if not path.is_file():
        raise AudioError(f"Missing {label}: {path}")
    actual = sha256(path)
    if require_hash and not re.fullmatch(r"[0-9a-f]{64}", expected or ""):
        raise AudioError(f"{label} needs a frozen sha256 before mixing: {path}")
    if expected and expected != actual:
        raise AudioError(f"Stale source hash for {label}: {path}. Review the replacement and update its ledger.")
    return actual


def verify_catalog(path: Path) -> dict[str, Any]:
    catalog = load_json(path)
    catalog_shape(catalog)
    for name, asset in catalog["assets"].items():
        asset_shape(asset, name)
        if asset.get("kind") != "procedural":
            verify_file((path.parent / asset["path"]).resolve(), asset.get("sha256"), name)
    return catalog


def prepare(project_path: Path) -> dict[str, Any]:
    project_path = project_path.resolve()
    project = load_json(project_path)
    fps = integer(project.get("fps"), "fps", 1, 240)
    frames = integer(project.get("durationInFrames"), "durationInFrames", 1)
    n = frame_sample(frames, fps)
    audio = object_value(project.get("audio", {}), "audio")
    mix = object_value(project.get("mix", {}), "mix")
    finite(mix.get("sfxGainDb", -6), "mix.sfxGainDb", -80, 24)
    finite(mix.get("musicGainDb", 3), "mix.musicGainDb", -80, 24)
    finite(mix.get("endFadeSeconds", min(.35, n / SR)), "mix.endFadeSeconds", 0, n / SR)
    finite(mix.get("samplePeakCeilingDbfs", -.5), "mix.samplePeakCeilingDbfs", -12, -.01)
    for bus, amount in object_value(mix.get("ducking", {}), "mix.ducking").items():
        if bus not in ("music", *BUSES):
            raise AudioError(f"Unknown ducking bus: {bus}")
        finite(amount, f"mix.ducking.{bus}", 0, .95)
    catalog_path = (project_path.parent / string_value(audio["assets"], "audio.assets")).resolve() if "assets" in audio else DEFAULT_CATALOG
    catalog = load_json(catalog_path)
    catalog_shape(catalog)
    inputs = {"catalog": {"path": str(catalog_path), "sha256": sha256(catalog_path)}}
    for kind in ("voice", "music"):
        item = audio.get(kind)
        if item is not None:
            object_value(item, f"audio.{kind}")
            path = (project_path.parent / string_value(item.get("path"), f"audio.{kind}.path")).resolve()
            actual = verify_file(path, item.get("sha256"), kind)
            metadata = probe(path)
            declared = item.get("durationSeconds")
            if declared is not None and abs(metadata["durationSeconds"] - finite(declared, f"{kind}.durationSeconds", 0)) > max(1 / fps, .02):
                raise AudioError(f"Stale declared duration for {kind}; probe the replacement recording")
            if kind == "voice" and metadata["durationSeconds"] > frames / fps + 1 / SR:
                raise AudioError("The timeline is shorter than the supplied voice. Extend durationInFrames; never trim narration implicitly.")
            if kind == "music":
                finite(item.get("gainDb", 0), "audio.music.gainDb", -80, 24)
            inputs[kind] = {"path": str(path), "sha256": actual, **metadata}
    prepared = []
    seen = set()
    shots = [object_value(shot, "shot") for shot in array_value(project.get("shots", []), "shots")]
    shot_ids = {string_value(shot.get("id"), "shot.id") for shot in shots}
    sound_fingerprint = []
    for event in array_value(project.get("events", []), "events"):
        object_value(event, "event")
        eid = event.get("id")
        if not isinstance(eid, str) or not eid or eid in seen:
            raise AudioError(f"Sound events need unique nonempty IDs: {eid}")
        seen.add(eid)
        integer(event.get("frame"), f"{eid}.frame", 0, frames - 1)
        if shot_ids and event.get("shot") not in shot_ids:
            raise AudioError(f"{eid}: unknown shot {event.get('shot')}")
        if event.get("sound") is None:
            continue
        sound = object_value(event["sound"], f"{eid}.sound")
        bus = sound.get("bus", "foley")
        if bus not in BUSES:
            raise AudioError(f"{eid}: sound.bus must be one of {BUSES}")
        seed = int.from_bytes(hashlib.sha256(f"{project.get('seed', 0)}:{eid}".encode()).digest()[:4], "big")
        variant = sound.get("variant")
        if variant is not None and (isinstance(variant, bool) or not isinstance(variant, int) or variant < 0):
            raise AudioError(f"{eid}.sound.variant must be a nonnegative integer")
        asset_id, asset, rate = resolve_asset(catalog, sound.get("asset", ""), variant, seed)
        if asset.get("kind") != "procedural":
            if asset.get("license") != "CC0-1.0" or not asset.get("sourceUrl"):
                raise AudioError(f"{asset_id}: recorded assets need a source URL and CC0-1.0 ledger")
            path = (catalog_path.parent / asset["path"]).resolve()
            actual = verify_file(path, asset.get("sha256"), asset_id)
            inputs[f"asset:{asset_id}"] = {"path": str(path), "sha256": actual}
        finite(sound.get("gainDb", 0), f"{eid}.sound.gainDb", -80, 24)
        finite(sound.get("pan", 0), f"{eid}.sound.pan", -1, 1)
        if sound.get("peakFrame") is not None:
            integer(sound["peakFrame"], f"{eid}.sound.peakFrame", 0, frames - 1)
        if sound.get("alignment", "onset") not in ("onset", "peak"):
            raise AudioError(f"{eid}: alignment must be onset or peak")
        if sound.get("durationSeconds") is not None:
            finite(sound["durationSeconds"], f"{eid}.sound.durationSeconds", .001, frames / fps)
        rate = finite(sound.get("rate", rate), f"{eid}.sound.rate", .5, 2)
        prepared.append({"event": event, "assetId": asset_id, "asset": asset, "rate": rate, "seed": seed})
        sound_fingerprint.append({key: event[key] for key in ("id", "shot", "frame", "type", "actor", "sound") if key in event})
    ffmpeg_version = command(["ffmpeg", "-version"]).decode().splitlines()[0]
    audio_project = {"fps": fps, "durationInFrames": frames, "seed": project.get("seed", 0),
                     "audio": audio, "mix": mix, "events": sound_fingerprint,
                     "shots": [{key: shot[key] for key in ("id", "start", "end") if key in shot} for shot in shots]}
    fingerprint_data = {"project": audio_project, "inputs": {key: value["sha256"] for key, value in sorted(inputs.items())},
                        "mixer": sha256(Path(__file__)), "numpy": np.__version__, "ffmpeg": ffmpeg_version}
    return {"project": project, "projectPath": project_path, "catalogPath": catalog_path,
            "fps": fps, "frames": int(frames), "n": n, "inputs": inputs, "events": prepared,
            "fingerprint": hashlib.sha256(canonical(fingerprint_data)).hexdigest()}


def sound_samples(item: dict[str, Any], catalog_path: Path,
                  decoded: dict[Path, np.ndarray] | None = None) -> tuple[np.ndarray, int]:
    asset, sound = item["asset"], item["event"]["sound"]
    duration = sound.get("durationSeconds", asset.get("durationSeconds", .3))
    if asset.get("kind") == "procedural":
        x = procedural(asset["generator"], duration, item["seed"])
    else:
        path = (catalog_path.parent / asset["path"]).resolve()
        if decoded is not None:
            if path not in decoded:
                decoded[path] = read(path)[:, 0]
            x = decoded[path]
        else:
            x = read(path)[:, 0]
        start = round(finite(asset.get("trim", {}).get("startSeconds", 0), "trim start", 0) * SR)
        stop = round(finite(asset.get("trim", {}).get("endSeconds", len(x) / SR), "trim end", 0) * SR)
        x = x[start:stop]
        if not len(x):
            raise AudioError(f"Empty catalog trim: {item['assetId']}")
    if item["rate"] != 1:
        x = np.interp(np.arange(0, len(x) - 1, item["rate"]), np.arange(len(x)), x).astype(np.float32)
    if sound.get("durationSeconds"):
        x = x[:round(sound["durationSeconds"] * SR)]
    x = edge(x, asset.get("attackSeconds", .003), asset.get("releaseSeconds", .025))
    maximum = float(np.max(np.abs(x)))
    if maximum == 0:
        raise AudioError(f"Silent asset/trim: {item['assetId']}")
    x *= db_gain(finite(asset.get("targetPeakDbfs", -14), "targetPeakDbfs", -80, 0)) / maximum
    x *= db_gain(asset.get("gainDb", 0) + sound.get("gainDb", 0))
    # Frozen catalog attack time is measured after its trim. Pitch scales that time.
    if "peakOffsetSeconds" in asset:
        attack = round(asset["peakOffsetSeconds"] * SR / item["rate"])
    else:
        attack = int(np.argmax(np.abs(x[:min(len(x), round(asset.get("attackWindowSeconds", .18) * SR))])))
    if not 0 <= attack < len(x):
        raise AudioError(f"Catalog attack falls outside edited sound: {item['assetId']}")
    return x, attack


def control_envelope(voice: np.ndarray) -> np.ndarray:
    n, hop = len(voice), SR // 100
    mono = np.max(np.abs(voice), axis=1)
    blocks = np.pad(mono, (0, (-n) % hop)).reshape(-1, hop)
    rms = np.sqrt(np.mean(blocks * blocks, axis=1))
    activity = np.clip((rms - .011) / .065, 0, 1)
    smooth, value = [], 0.
    for target in activity:
        coefficient = math.exp(-.01 / (.025 if target > value else .28))
        value = float(target) + (value - float(target)) * coefficient
        smooth.append(value)
    return np.interp(np.arange(n), np.arange(len(smooth)) * hop, smooth).astype(np.float32)


def active_voice_rms_dbfs(voice: np.ndarray) -> float | None:
    """An amplitude reference for the bank, not an integrated-loudness target."""
    mono = np.max(np.abs(voice), axis=1)
    hop = SR // 50
    blocks = np.pad(mono, (0, (-len(mono)) % hop)).reshape(-1, hop)
    rms = np.sqrt(np.mean(blocks * blocks, axis=1))
    maximum = float(np.max(rms))
    if maximum == 0:
        return None
    active = rms[rms > max(maximum * .1, 1e-12)]
    return float(20 * math.log10(float(np.percentile(active, 65)))) if len(active) else None


def protect_voice(voice: np.ndarray, other: np.ndarray, ceiling: float) -> np.ndarray:
    """Reduce only non-voice buses, with short lookahead and a smooth release."""
    needed = np.clip((ceiling - np.abs(voice)) / (np.abs(other) + 1e-12), 0, 1).min(axis=1)
    n, hop = len(voice), 192
    blocks = np.pad(needed, (0, (-n) % hop), constant_values=1).reshape(-1, hop).min(axis=1)
    blocks = np.minimum(blocks, np.r_[blocks[1:], 1])
    smooth, value = [], 1.
    for target in blocks:
        value = min(float(target), value + (1 - value) * (1 - math.exp(-.004 / .09)))
        smooth.append(value)
    # Hold each conservative block value; interpolating upward can break its peak bound.
    return np.repeat(np.asarray(smooth, np.float32), hop)[:n]


def measure(path: Path) -> dict[str, Any]:
    result = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                             "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json",
                             "-f", "null", "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    match = re.search(r'\{\s*"input_i"[\s\S]*?\}', result.stderr.decode(errors="replace"))
    if result.returncode or not match:
        return {"status": "unavailable", "reason": "ffmpeg loudnorm measurement unavailable"}
    data = json.loads(match.group())
    def value(key: str) -> float | None:
        number = float(data[key])
        return number if math.isfinite(number) else None
    return {"status": "measured", "integratedLufs": value("input_i"), "truePeakDbtp": value("input_tp"),
            "loudnessRangeLu": value("input_lra"), "note": "Measurement only; no loudness normalization applied."}


def check_cache(prepared: dict[str, Any], output: Path) -> bool:
    report_path = output / "mix-report.json"
    if not report_path.is_file():
        raise AudioError("No mix cache. Run the mixer to create current stems.")
    report = load_json(report_path)
    if report.get("fingerprint") != prepared["fingerprint"]:
        raise AudioError("Stale mix cache: project, catalog, source, or mixer changed. Rebuild stems.")
    for name, expected in report.get("outputs", {}).items():
        verify_file(output / name, expected, f"cached output {name}")
    if set(report.get("outputs", {})) != {*(f"{bus}.wav" for bus in STEMS), "preview-mix.wav", "cues.json"}:
        raise AudioError("Incomplete mix cache. Rebuild stems.")
    return True


def build(prepared: dict[str, Any], output: Path, metrics: bool = True) -> dict[str, Any]:
    p, n, fps = prepared["project"], prepared["n"], prepared["fps"]
    output = output.resolve()
    names = {*(f"{bus}.wav" for bus in STEMS), "preview-mix.wav", "cues.json", "mix-report.json"}
    input_paths = {Path(value["path"]).resolve() for value in prepared["inputs"].values()}
    if any((output / name).resolve() in input_paths for name in names):
        raise AudioError("Output would overwrite an input. Choose a separate audio output directory.")
    stems = {bus: np.zeros((n, 2), np.float32) for bus in STEMS}
    if "voice" in prepared["inputs"]:
        voice = stereo_unity(Path(prepared["inputs"]["voice"]["path"]))
        if len(voice) > n:
            raise AudioError("Decoded voice exceeds the timeline. Extend durationInFrames; narration will not be truncated.")
        stems["voice"][:len(voice)] = voice
    voice_hash = hashlib.sha256(stems["voice"].tobytes()).hexdigest()
    if float(np.max(np.abs(stems["voice"]))) >= 1:
        raise AudioError("The supplied narration is already clipped. Supply a clean recording; the mixer will not change its gain.")
    if "music" in prepared["inputs"]:
        music = stereo_unity(Path(prepared["inputs"]["music"]["path"]))
        stems["music"][:min(n, len(music))] = music[:n]
    cues, decoded = [], {}
    for item in prepared["events"]:
        event, sound = item["event"], item["event"]["sound"]
        x, attack = sound_samples(item, prepared["catalogPath"], decoded)
        contact = sound.get("peakFrame", event["frame"])
        align_peak = "peakFrame" in sound or sound.get("alignment", "peak" if event.get("type") == "contact" else "onset") == "peak"
        start = frame_sample(contact if align_peak else event["frame"], fps) - (attack if align_peak else 0)
        source_start, destination_start = max(0, -start), max(0, start)
        length = min(len(x) - source_start, n - destination_start)
        if length <= 0:
            raise AudioError(f"{event['id']}: edited sound is outside the composition")
        pan = sound.get("pan", 0)
        gains = np.array([math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)], np.float32)
        stems[sound.get("bus", "foley")][destination_start:destination_start + length] += x[source_start:source_start + length, None] * gains
        cues.append({"id": event["id"], "shot": event.get("shot"), "actor": event.get("actor"),
                     "type": event.get("type"), "asset": item["assetId"], "bus": sound.get("bus", "foley"),
                     "frame": event["frame"], "peakFrame": contact if align_peak else None,
                     "startSample": destination_start, "unclippedStartSample": start,
                     "sourceOffsetSamples": source_start, "durationSamples": length,
                     "seconds": destination_start / SR, "attackOffsetSamples": attack,
                     "rate": item["rate"], "gainDb": sound.get("gainDb", 0),
                     "pan": pan, "tailTruncated": source_start + length < len(x)})
    mix = p.get("mix", {})
    sfx_gain = db_gain(finite(mix.get("sfxGainDb", -6), "mix.sfxGainDb", -80, 24))
    music_gain = db_gain(finite(mix.get("musicGainDb", 3), "mix.musicGainDb", -80, 24)
                         + finite((p.get("audio", {}).get("music") or {}).get("gainDb", 0), "audio.music.gainDb", -80, 24))
    active_voice_db = active_voice_rms_dbfs(stems["voice"])
    # The bank was authored around an active RMS reference of -20 dBFS. Quiet
    # narration lowers only non-voice buses; a hot voice never boosts effects.
    calibration_db = min(0., active_voice_db + 20) if active_voice_db is not None else 0.
    calibration_gain = db_gain(calibration_db)
    activity = control_envelope(stems["voice"] / calibration_gain)
    ducking = {"music": .45, "foley": .16, "accents": .25, "reactions": .30, "ambience": .40}
    ducking.update(mix.get("ducking", {}))
    for bus in ("music", *BUSES):
        amount = finite(ducking[bus], f"mix.ducking.{bus}", 0, .95)
        stems[bus] *= ((1 - amount * activity) * calibration_gain
                       * (music_gain if bus == "music" else sfx_gain))[:, None]
    end_seconds = finite(mix.get("endFadeSeconds", min(.35, n / SR)), "mix.endFadeSeconds", 0, n / SR)
    if end_seconds:
        fade = np.minimum((n - 1 - np.arange(n)) / (SR * end_seconds), 1).astype(np.float32)
        for bus in ("music", *BUSES):
            stems[bus] *= fade[:, None]
    other = sum(stems[bus] for bus in ("music", *BUSES))
    target_ceiling = db_gain(finite(mix.get("samplePeakCeilingDbfs", -.5), "mix.samplePeakCeilingDbfs", -12, -.01))
    voice_peak = float(np.max(np.abs(stems["voice"])))
    ceiling = max(target_ceiling, voice_peak)
    headroom = protect_voice(stems["voice"], other, ceiling)
    for bus in ("music", *BUSES):
        stems[bus] *= headroom[:, None]
    final = stems["voice"] + sum(stems[bus] for bus in ("music", *BUSES))
    if float(np.max(np.abs(final))) >= 1:
        raise AudioError("Mix exceeds full scale. Lower effect/music gains; narration is preserved.")
    if hashlib.sha256(stems["voice"].tobytes()).hexdigest() != voice_hash:
        raise AssertionError("Narration changed during mixing")
    output.mkdir(parents=True, exist_ok=True)
    for bus, x in stems.items():
        save_float_wav(output / f"{bus}.wav", x)
    save_float_wav(output / "preview-mix.wav", final)
    (output / "cues.json").write_text(json.dumps(sorted(cues, key=lambda cue: (cue["frame"], cue["id"])), indent=2) + "\n")
    correlation = float(np.corrcoef(final.T)[0, 1]) if np.std(final[:, 0]) and np.std(final[:, 1]) else None
    report = {"version": 1, "fingerprint": prepared["fingerprint"], "sampleRate": SR,
              "durationInFrames": prepared["frames"], "fps": fps, "samples": n,
              "inputs": prepared["inputs"], "cueCount": len(cues),
              "voice": {"gain": 1, "sourceFileModified": False, "decodedPcmSha256": voice_hash,
                        "status": "unity, padded only" if "voice" in prepared["inputs"] else "not supplied"},
              "calibration": {"voiceActiveRmsDbfs": active_voice_db, "bankReferenceActiveRmsDbfs": -20,
                              "nonVoiceTrimDb": calibration_db,
                              "note": "Attenuates non-voice only for quiet narration; never boosts effects or normalizes voice."},
              "stems": {bus: {"samplePeakDbfs": db_peak(x)} for bus, x in stems.items()},
              "samplePeakDbfs": db_peak(final), "monoCorrelation": correlation,
              "nonVoiceHeadroomReductionDb": round(20 * math.log10(max(float(headroom.min()), 1e-12)), 4),
              "loudness": measure(output / "preview-mix.wav") if metrics else {"status": "not measured"},
              "audition": {"status": "pending", "note": "Metrics do not verify expression, audibility, or synchronization. Listen with picture."},
              "warnings": (["Voice alone exceeds the requested sample-peak ceiling; its gain is preserved."] if voice_peak > target_ceiling else [])
                          + (["No narration supplied: this is a sound sketch, not a verified final mix."] if "voice" not in prepared["inputs"] else []),
              "playback": "All generated stems already contain final gains. Play at volume 1; do not also play original narration.",
              "outputs": {name: sha256(output / name) for name in sorted(names - {"mix-report.json"})}}
    (output / "mix-report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path, nargs="?")
    parser.add_argument("--out", type=Path, help="Generated audio directory (required for build/cache check)")
    parser.add_argument("--validate", action="store_true", help="Read/check inputs only; write nothing")
    parser.add_argument("--check-cache", action="store_true", help="Fail if configuration, sources, implementation or outputs changed")
    parser.add_argument("--force", action="store_true", help="Rebuild even when the fingerprint matches")
    parser.add_argument("--no-metrics", action="store_true", help="Skip optional loudness/true-peak measurement")
    parser.add_argument("--verify-catalog", type=Path, nargs="?", const=DEFAULT_CATALOG, help="Verify every bundled recording/hash without a project")
    args = parser.parse_args()
    try:
        if args.verify_catalog:
            catalog = verify_catalog(args.verify_catalog.resolve())
            print(json.dumps({"status": "verified", "assets": len(catalog["assets"])}))
            return 0
        if not args.project:
            parser.error("project.json is required unless --verify-catalog is used")
        prepared = prepare(args.project)
        if args.validate:
            print(json.dumps({"status": "valid", "fingerprint": prepared["fingerprint"], "soundEvents": len(prepared["events"])}))
            return 0
        if not args.out:
            parser.error("--out is required for build/cache check")
        if args.check_cache:
            check_cache(prepared, args.out)
            print(json.dumps({"status": "current", "fingerprint": prepared["fingerprint"]}))
            return 0
        if not args.force:
            try:
                check_cache(prepared, args.out)
                print(json.dumps({"status": "cached", "fingerprint": prepared["fingerprint"]}))
                return 0
            except AudioError:
                pass
        report = build(prepared, args.out, metrics=not args.no_metrics)
        print(json.dumps({"status": "built", "out": str(args.out.resolve()), "fingerprint": report["fingerprint"],
                          "cueCount": report["cueCount"], "loudness": report["loudness"], "audition": "pending"}))
        return 0
    except (AudioError, KeyError, TypeError) as error:
        print(f"Audio check failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
