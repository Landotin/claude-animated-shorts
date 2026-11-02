"""Meaningful checks for timing, immutable voice, and stale/missing sources."""
import importlib.util
import json
import shutil
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

SPEC = importlib.util.spec_from_file_location("cartoon_mix", Path(__file__).with_name("mix.py"))
mix = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mix)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg + ffprobe required")
class MixerTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="cartoon-audio-")
        self.root = Path(self.temporary.name)
        self.asset = self.root / "contact.wav"
        # A delayed impulse makes the contact alignment independent of file start.
        x = np.zeros((12000, 2), np.float32)
        x[2400] = .5
        mix.save_float_wav(self.asset, x)
        self.catalog = {"version": 1, "assets": {"contact": {
            "kind": "recording", "path": "contact.wav", "sha256": mix.sha256(self.asset),
            "license": "CC0-1.0", "sourceUrl": "https://example.test/fixture-created-by-test",
            "trim": {"startSeconds": 0, "endSeconds": .25}, "peakOffsetSeconds": .05,
            "targetPeakDbfs": -12, "pitchVariants": [1], "attackSeconds": 0, "releaseSeconds": 0}},
            "aliases": {"hit": ["contact"]}}
        self.catalog_path = self.root / "catalog.json"
        self.catalog_path.write_text(json.dumps(self.catalog))
        self.project = {"fps": 30, "durationInFrames": 90, "seed": 7,
                        "audio": {"assets": "catalog.json"},
                        "mix": {"sfxGainDb": -6}, "shots": [{"id": "a", "start": 0, "end": 90}],
                        "events": [{"id": "strike", "shot": "a", "frame": 28, "type": "contact",
                                    "sound": {"asset": "hit", "bus": "foley", "peakFrame": 30}}]}
        self.project_path = self.root / "project.json"
        self.output = self.root / "out"

    def tearDown(self):
        self.temporary.cleanup()

    def prepare(self):
        self.project_path.write_text(json.dumps(self.project))
        return mix.prepare(self.project_path)

    def test_contact_peak_lands_on_shared_frame(self):
        prepared = self.prepare()
        report = mix.build(prepared, self.output, metrics=False)
        rendered = mix.read(self.output / "foley.wav", 2)
        self.assertEqual(int(np.argmax(abs(rendered[:, 0]))), 48000)
        cue = json.loads((self.output / "cues.json").read_text())[0]
        self.assertEqual(cue["unclippedStartSample"] + cue["attackOffsetSamples"], 48000)
        self.assertEqual(report["voice"]["gain"], 1)
        self.assertTrue(mix.check_cache(prepared, self.output))

    def test_voice_remains_unity_under_loud_effects(self):
        path = self.root / "narration.wav"
        source = (.7 * np.sin(2 * np.pi * 233 * np.arange(110000) / mix.SR)).astype(np.float32)
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(mix.SR)
            handle.writeframes((source * 32767).astype("<i2").tobytes())
        self.project["audio"]["voice"] = {"path": path.name, "sha256": mix.sha256(path),
                                            "durationSeconds": len(source) / mix.SR}
        self.project["events"][0]["sound"]["gainDb"] = 24
        original_hash = mix.sha256(path)
        prepared = self.prepare()
        report = mix.build(prepared, self.output, metrics=False)
        actual = mix.read(self.output / "voice.wav", 2)
        expected = np.pad(mix.stereo_unity(path), ((0, prepared["n"] - len(source)), (0, 0)))
        np.testing.assert_array_equal(actual, expected)
        self.assertEqual(mix.sha256(path), original_hash)
        self.assertLess(float(np.max(np.abs(mix.read(self.output / "preview-mix.wav", 2)))), 1)
        self.assertLess(report["nonVoiceHeadroomReductionDb"], 0)

    def test_quiet_voice_lowers_only_nonvoice_buses(self):
        path = self.root / "narration.wav"
        source = (.01 * np.sin(2 * np.pi * 233 * np.arange(110000) / mix.SR)).astype(np.float32)
        mix.save_float_wav(path, np.repeat(source[:, None], 2, axis=1))
        self.project["audio"]["voice"] = {"path": path.name, "sha256": mix.sha256(path),
                                            "durationSeconds": len(source) / mix.SR}
        original_hash = mix.sha256(path)
        prepared = self.prepare()
        report = mix.build(prepared, self.output, metrics=False)
        self.assertLess(report["calibration"]["nonVoiceTrimDb"], -20)
        self.assertEqual(report["voice"]["gain"], 1)
        actual = mix.read(self.output / "voice.wav", 2)
        expected = np.pad(mix.stereo_unity(path), ((0, prepared["n"] - len(source)), (0, 0)))
        np.testing.assert_array_equal(actual, expected)
        self.assertEqual(mix.sha256(path), original_hash)
        self.assertLess(float(np.max(abs(mix.read(self.output / "foley.wav", 2)))), .01)

    def test_missing_asset_is_actionable(self):
        self.asset.unlink()
        with self.assertRaisesRegex(mix.AudioError, "Missing contact"):
            self.prepare()

    def test_changed_source_hash_and_stale_outputs_fail(self):
        prepared = self.prepare()
        mix.build(prepared, self.output, metrics=False)
        (self.output / "foley.wav").write_bytes(b"changed")
        with self.assertRaisesRegex(mix.AudioError, "Stale source hash"):
            mix.check_cache(prepared, self.output)
        self.asset.write_bytes(self.asset.read_bytes() + b"changed source")
        with self.assertRaisesRegex(mix.AudioError, "Stale source hash for contact"):
            self.prepare()

    def test_changed_event_invalidates_cache_and_new_fps_sets_length(self):
        prepared = self.prepare()
        mix.build(prepared, self.output, metrics=False)
        self.project["fps"] = 24
        self.project["durationInFrames"] = 72
        self.project["shots"][0]["end"] = 72
        changed = self.prepare()
        self.assertEqual(changed["n"], 144000)
        self.assertNotEqual(changed["fingerprint"], prepared["fingerprint"])
        with self.assertRaisesRegex(mix.AudioError, "Stale mix cache"):
            mix.check_cache(changed, self.output)

    def test_review_and_camera_notes_do_not_regenerate_audio(self):
        prepared = self.prepare()
        mix.build(prepared, self.output, metrics=False)
        self.project["title"] = "A clearer title"
        self.project["review"] = {"technical": "passed", "audio": "pending"}
        self.project["shots"][0]["camera"] = {"note": "move closer"}
        self.project["events"][0]["visual"] = "Improved contact description"
        unchanged = self.prepare()
        self.assertEqual(prepared["fingerprint"], unchanged["fingerprint"])
        self.assertTrue(mix.check_cache(unchanged, self.output))
        self.project["events"][0]["frame"] += 1
        changed = self.prepare()
        with self.assertRaisesRegex(mix.AudioError, "Stale mix cache"):
            mix.check_cache(changed, self.output)

    def test_explicit_silence_is_skipped(self):
        self.project["events"].append({"id": "quiet-look", "shot": "a", "frame": 65,
                                         "type": "camera", "sound": None, "silenceReason": "Quiet ending"})
        prepared = self.prepare()
        self.assertEqual(len(prepared["events"]), 1)
        report = mix.build(prepared, self.output, metrics=False)
        self.assertEqual(report["cueCount"], 1)

    def test_boolean_and_fractional_event_frames_are_rejected(self):
        for value in (False, True, 1.5):
            with self.subTest(frame=value):
                self.project["events"][0]["frame"] = value
                with self.assertRaises(mix.AudioError):
                    self.prepare()
        self.project["events"][0]["frame"] = 28
        for value in (False, 29.5):
            with self.subTest(peakFrame=value):
                self.project["events"][0]["sound"]["peakFrame"] = value
                with self.assertRaises(mix.AudioError):
                    self.prepare()

    def test_contact_defaults_to_peak_alignment(self):
        self.project["events"][0]["frame"] = 30
        self.project["events"][0]["sound"].pop("peakFrame")
        mix.build(self.prepare(), self.output, metrics=False)
        rendered = mix.read(self.output / "foley.wav", 2)
        self.assertEqual(int(np.argmax(abs(rendered[:, 0]))), 48000)

    def test_malformed_sound_and_catalog_get_actionable_errors(self):
        self.project["events"][0]["sound"] = ["not", "an object"]
        with self.assertRaisesRegex(mix.AudioError, "strike.sound must be a JSON object"):
            self.prepare()
        self.project["events"][0]["sound"] = {"asset": "hit"}
        self.catalog["assets"]["contact"] = ["broken"]
        self.catalog_path.write_text(json.dumps(self.catalog))
        with self.assertRaisesRegex(mix.AudioError, "catalog.assets.contact must be a JSON object"):
            self.prepare()

    def test_timeline_never_silently_trims_voice(self):
        path = self.root / "voice-too-long.wav"
        mix.save_float_wav(path, np.zeros((mix.SR * 4, 2), np.float32))
        self.project["audio"]["voice"] = {"path": path.name, "sha256": mix.sha256(path)}
        with self.assertRaisesRegex(mix.AudioError, "timeline is shorter"):
            self.prepare()

    def test_output_never_overwrites_voice(self):
        path = self.root / "voice.wav"
        mix.save_float_wav(path, np.zeros((mix.SR * 2, 2), np.float32))
        self.project["audio"]["voice"] = {"path": path.name, "sha256": mix.sha256(path)}
        with self.assertRaisesRegex(mix.AudioError, "overwrite an input"):
            mix.build(self.prepare(), self.root, metrics=False)


if __name__ == "__main__":
    unittest.main()
