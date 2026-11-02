# Frame-locked sound kit

This mixer reads the same event frames as the animation. Recorded materials, nonverbal character reactions, face accents, atmosphere and music remain separate editable stems. It generates audio only; it never exports a movie or starts a browser.

Install Python 3.10+, `ffmpeg` and `ffprobe` on PATH, then:

```sh
python -m pip install -r kit/audio/requirements.txt
python kit/audio/mix.py path/to/project.json --validate
python kit/audio/mix.py path/to/project.json --out path/to/public/audio
python kit/audio/mix.py path/to/project.json --out path/to/public/audio --check-cache
python kit/audio/mix.py --verify-catalog
python -m unittest discover -s kit/audio -p 'test_*.py'
```

`--validate` and `--verify-catalog` write nothing. A normal build reuses verified outputs when their fingerprint matches; `--force` rebuilds. `--check-cache` fails if sound timing/configuration, shot ranges, mixer, catalog, decoded-tool version, input bytes or generated outputs changed. Titles, review notes and camera/visual edits do not regenerate unchanged sound. Replacing an input without reviewing and updating its SHA-256 fails before a build. `--no-metrics` skips the optional loudness measurement.

## Project interface

Paths in the project are relative to its JSON file. Recording paths in the catalog are relative to the catalog. An omitted voice or music is allowed for a sound sketch and is recorded as missing in the report. A supplied voice or music needs its actual SHA-256. Preserve the narration's natural duration; the mixer rejects a composition shorter than the supplied recording.

```json
{
  "schemaVersion": 1,
  "id": "DrinkExample",
  "title": "The poisoned cup",
  "subject": "An example of readable action and reaction",
  "storyMode": "biography",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "durationInFrames": 360,
  "entry": "src/index.ts",
  "outputMode": "preview",
  "captions": false,
  "language": "en",
  "seed": 17,
  "audio": {
    "assets": "../../assets/sfx/catalog.json",
    "voice": {
      "path": "private/narration.wav",
      "sha256": "REPLACE_WITH_ACTUAL_SHA256",
      "durationSeconds": 11.99
    },
    "music": {
      "path": "private/music.wav",
      "sha256": "REPLACE_WITH_ACTUAL_SHA256",
      "gainDb": 0
    }
  },
  "mix": {
    "sfxGainDb": -6,
    "musicGainDb": 3,
    "ducking": {"music": 0.45, "foley": 0.16, "reactions": 0.3, "accents": 0.25, "ambience": 0.4},
    "endFadeSeconds": 0.35,
    "samplePeakCeilingDbfs": -0.5
  },
  "shots": [{"id": "drink", "start": 0, "end": 360}],
  "events": [
    {"id": "cup-contact", "shot": "drink", "frame": 48, "type": "contact", "actor": "father", "visual": "The cup rim touches his mouth",
     "sound": {"asset": "cup", "bus": "foley", "alignment": "peak", "gainDb": -3, "pan": -0.08}},
    {"id": "swallow", "shot": "drink", "frame": 51, "type": "contact", "actor": "father", "visual": "He tilts the cup and swallows",
     "sound": {"asset": "gulp", "bus": "foley", "alignment": "onset", "variant": 0}},
    {"id": "poison-reaction", "shot": "drink", "frame": 61, "type": "reaction", "actor": "father", "visual": "His face turns sick and his body recoils",
     "sound": {"asset": "poisoned-grunt", "bus": "reactions", "durationSeconds": 0.37}},
    {"id": "eyes-close", "shot": "drink", "frame": 90, "type": "blink", "actor": "father",
     "sound": {"asset": "blink", "bus": "accents", "gainDb": -2}}
  ],
  "review": {"technical": "pending", "visual": "pending", "audio": "pending"}
}
```

Only events containing a sound object produce cues. `sound: null` records an intentional silence; include its reason in the project. Every sound uses one of `foley`, `reactions`, `accents`, `ambience`. A sound's `asset` is a catalog ID or alias. `gainDb` adds an event trim, `pan` is -1 to +1, `durationSeconds` crops a tail, and `rate` is a pitch/speed ratio from 0.5 to 2. Use these deliberately; do not pitch a character differently on every cut.

For `type: "contact"`, the measured first transient lands on `event.frame` by default. Other event types start their sound on that frame. `alignment: "peak"` or `"onset"` overrides the default. Optional `peakFrame` gives an explicit global contact frame and enables peak alignment. Use peak alignment for stone hits, collar closures, footfalls, sword contact and dropped objects; use onset alignment for crying, gasps, grunts, swallowing and an eyelid chirp. Leading audio before frame zero is clipped explicitly and reported. Every cue reports its attack, exact sample placement, selected variation and truncated tails.

`variant` selects reproducibly from alias alternatives and their pitch variants. Without it, the project seed and stable event ID select a variation. Retiming an event does not randomly change its take. Catalog trims and transient offsets are frozen rather than guessed on each run. `python kit/audio/build_catalog.py` recalculates them from the unchanged included source files; review the result before committing.

## Included bank

All **recorded files** under `assets/sfx` are CC0. The catalog contains source URLs, creator, license, byte hash, source trim, measured attack offset, peak target and pitch choices. The original Kenney license and vocal source ledgers are retained. See [the source/license ledger](../../assets/sfx/LICENSES.md).

Useful aliases:

| Purpose | Aliases |
| --- | --- |
| Material and movement | `cloth`, `leather`, `footstep`, `impact`, `wood`, `wood-creak`, `metal`, `metal-latch`, `cup`, `blade`, `body-fall`, `soil` |
| Nonverbal performance | `gulp`, `cry`, `gasp`, `angry`, `effort`, `poisoned-grunt` |
| Face and designed accents | `blink`, `whoosh`, `pop`, `chime`, `weight`, `shock` |
| Atmosphere | `wind`, `water`, `fire` |

`whoosh`, `pop`, `chime`, `weight`, `shock` and atmospheres use original deterministic synthesis in this kit, rather than restricted third-party accent recordings. The repository's MIT license covers this code. Choose real Foley and vocal performances for recognizable actions; accents support them.

## Mix and preview contract

The output contains `voice.wav`, `music.wav`, `foley.wav`, `accents.wav`, `reactions.wav`, `ambience.wav`, `preview-mix.wav`, `cues.json` and `mix-report.json`. Float WAV stems preserve decoded sample amplitude. The supplied voice file is never edited, normalized, faded, compressed, pitched or rewritten. A mono narrator is copied to both channels at unity; stereo is preserved. Silence is added only after the recording to fill the timeline.

Every output stem **already contains its final gain, voice ducking and non-voice headroom control**. Play each stem at volume **1** in Remotion. Run `short.py sync` after rebuilding: its per-file hash becomes the preview URL version so a browser cannot reuse an older stem. Do not also play the original narrator or the full preview mix alongside these stems. Alternatively, audition `preview-mix.wav` on its own. `mix.musicGainDb` and the optional music item's `gainDb` add together.

The bank's starting levels assume an active voice RMS reference of -20 dBFS. For quieter narration, the mixer conservatively lowers all non-voice buses by the difference; a hotter voice never automatically boosts effects. This amplitude reference is reported under `calibration` and is not a loudness normalization target. The voice gain remains 1.

The mixer creates headroom by lowering only music/effects. It rejects an already clipped narrator instead of changing that performance. Integrated loudness, true peak, sample peak and mono correlation are measured/reported where available; the full mix is never automatically normalized. Loudness targets depend on the recording and destination. Measurements cannot determine whether a gulp is recognizable or a gasp matches the face.

Before marking a sound revision complete, listen with picture to the opening, every new expression/contact, one crowded action passage and the quiet ending. Check headphones and a mono phone-speaker approximation. Keep the narrator clear, choose material-specific Foley, and distinguish anger from shock. Sound selected visible principal blinks only when the style calls for them; do not add chirps to invisible/background eyes. Use quiet or absent accents around grief and the ending. The report deliberately leaves `audition.status` as `pending`; a person or a reviewer able to listen must record the outcome in the project's review state.
