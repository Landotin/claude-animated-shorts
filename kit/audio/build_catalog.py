#!/usr/bin/env python3
"""Rebuild frozen trims/attack metadata from the included CC0 source recordings."""
import json
from pathlib import Path

import numpy as np

from mix import REPO, SR, edge, read, sha256, verify_file

ROOT = REPO / "assets/sfx"
ASSETS = {}


def add(asset_id, relative, source, *, offset=0, length=None, peak=-14, tags=()):
    path = ROOT / relative
    if source.get("sha256"):
        verify_file(path, source["sha256"], relative)
    x = read(path)[:, 0]
    active = np.flatnonzero(np.abs(x) > max(.002, float(np.max(np.abs(x))) * .018))
    if not len(active):
        raise ValueError(f"Silent recording: {relative}")
    start = max(0, int(active[0]) - 144) + round(offset * SR)
    end = min(len(x), int(active[-1]) + 2400)
    if length:
        end = min(end, start + round(length * SR))
    trimmed = edge(x[start:end])
    attack = int(np.argmax(np.abs(trimmed[:min(len(trimmed), round(.18 * SR))])))
    ASSETS[asset_id] = {"kind": "recording", "path": relative, "sha256": sha256(path),
                        "title": source["title"], "creator": source["creator"],
                        "sourceUrl": source["source_url"], "downloadUrl": source["download_url"],
                        "license": "CC0-1.0", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                        "trim": {"startSeconds": round(start / SR, 8), "endSeconds": round(end / SR, 8)},
                        "peakOffsetSeconds": round(attack / SR, 8), "targetPeakDbfs": peak,
                        "gainDb": 0, "pitchVariants": [1, .96, 1.04],
                        "attackSeconds": .003, "releaseSeconds": .035, "tags": list(tags)}


def main():
    kenney = {"title": "RPG Audio", "creator": "Kenney Vleugels",
              "source_url": "https://kenney.nl/assets/rpg-audio",
              "download_url": "https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip"}
    for path in sorted((ROOT / "kenney-rpg").glob("*.ogg")):
        add("kenney/" + path.stem, str(path.relative_to(ROOT)), kenney,
            length=.7, tags=("foley",))
    sources = json.loads((ROOT / "vocals/SOURCES.json").read_text())
    for source in sources:
        if "file" in source:
            asset_id = {"male-gasp-jawbutch.mp3": "voice/male-gasp",
                        "female-gasp-slamaxu.mp3": "voice/female-gasp",
                        "angry-grunt-rocotilos.mp3": "voice/angry-intake"}[source["file"]]
            add(asset_id, "vocals/" + source["file"], source, length=.5, peak=-7, tags=("reaction",))
        else:
            for filename, digest in sorted(source["files"].items()):
                add("voice/effort-" + filename.split("-")[-1].split(".")[0],
                    "vocals/" + source["folder"] + "/" + filename,
                    {**source, "sha256": digest}, length=.4, peak=-9, tags=("effort", "reaction"))
    for source in json.loads((ROOT / "OPENING-SOURCES.json").read_text()):
        filename = source["file"]
        if filename == "cartoon-blink-firecamel.mp3":
            add("face/blink", filename, source, length=.12, peak=-24, tags=("blink", "accent"))
        elif filename == "drink-gulp-zac.mp3":
            add("human/gulp", filename, source, length=.35, peak=-12, tags=("drink", "foley"))
        elif "sobbing" in filename:
            add("voice/cry-a", filename, source, offset=.35, length=2.35, peak=-9, tags=("cry", "reaction"))
            add("voice/cry-b", filename, source, offset=6, length=2.3, peak=-10, tags=("cry", "reaction"))
        elif "angry" in filename:
            add("voice/angry-a", filename, source, length=.43, peak=-5, tags=("angry", "reaction"))
            add("voice/angry-b", filename, source, offset=8.62, length=.44, peak=-5, tags=("angry", "reaction"))
    for kind, duration, peak in [("whoosh", .3, -18), ("pop", .17, -22), ("chime", .7, -20),
                                 ("weight", .28, -17), ("shock", .3, -18),
                                 ("wind", 3, -32), ("water", 3, -30), ("fire", 3, -32)]:
        ASSETS["dsp/" + kind] = {"kind": "procedural", "generator": kind, "durationSeconds": duration,
                                 "creator": "cartoon-3d-short contributors", "license": "MIT",
                                 "sourceUrl": "kit/audio/mix.py", "targetPeakDbfs": peak,
                                 "gainDb": 0, "pitchVariants": [1], "tags": ["ambience" if kind in ("wind", "water", "fire") else "accent"]}
    aliases = {
        "cloth": ["kenney/cloth1", "kenney/cloth2", "kenney/cloth3", "kenney/cloth4"],
        "leather": ["kenney/beltHandle1", "kenney/beltHandle2", "kenney/clothBelt", "kenney/clothBelt2"],
        "footstep": [f"kenney/footstep{i:02}" for i in range(10)],
        "impact": ["kenney/chop", "kenney/bookClose"], "wood": ["kenney/bookClose", "kenney/bookPlace1"],
        "wood-creak": ["kenney/creak1", "kenney/creak2", "kenney/creak3"],
        "metal": ["kenney/metalPot1", "kenney/metalPot2", "kenney/metalPot3"],
        "metal-latch": ["kenney/metalLatch"], "cup": ["kenney/metalPot2"],
        "blade": ["kenney/knifeSlice", "kenney/knifeSlice2"],
        "body-fall": ["kenney/dropLeather"], "soil": ["kenney/footstep06", "kenney/footstep08"],
        "gulp": ["human/gulp"], "cry": ["voice/cry-a", "voice/cry-b"],
        "gasp": ["voice/male-gasp", "voice/female-gasp"],
        "angry": ["voice/angry-a", "voice/angry-b", "voice/angry-intake"],
        "effort": ["voice/effort-02", "voice/effort-06", "voice/effort-11"],
        "poisoned-grunt": ["voice/effort-06"], "blink": ["face/blink"],
        **{kind: ["dsp/" + kind] for kind in ("whoosh", "pop", "chime", "weight", "shock", "wind", "water", "fire")}}
    catalog = {"version": 1, "sampleRate": SR,
               "notes": "Recorded files are unmodified CC0 sources. Trims, levels and pitch variants are editable starting points, not an audition certificate. Procedural accents use original MIT code, with no third-party accent audio.",
               "assets": ASSETS, "aliases": aliases}
    (ROOT / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Frozen {len(ASSETS)} assets and {len(aliases)} aliases")


if __name__ == "__main__":
    main()
