# Cartoon 3D Animated Shorts

A reusable skill and production kit for narrated cartoon stories: flat bean-head characters in a painted, ink-outlined 3D world, built with three.js and Remotion. The look comes from **The Bridge That Fell for a Song**; the Genghis Khan revisions add explicit physical actions, character reactions, and a fuller sound workflow.

Supplied narration determines the length. The kit supports preview-only delivery, preserves approved voice audio, and keeps picture and sound on one event clock. Its instructions work with different assistants; smaller-model reliability still requires a measured evaluation.

| Path | Purpose |
|---|---|
| `SKILL.md` | Short entrypoint and production rules |
| `kit/` | Project contract, portable commands, event helpers, audio tools, and examples |
| `references/production.md` | Story/action recipes, sound design, and revision workflow |
| `references/look.md` | Precise visual baseline and rendering pitfalls |
| `references/review.md` | Technical, visual, audio, and reproducibility checks |
| `templates/bridge/` | Original bridge scene code; a worked example |
| `templates/audio/`, `templates/scripts/` | Legacy bridge sound and review helpers |
| `references/STYLE_BIBLE.md`, `references/reports/` | Written style-study observations |

## Setup

Install the folder as `cartoon-3d-short` in your assistant's skills directory. Use a supported Node.js runtime with npm, Python 3.10+, ffmpeg and ffprobe available on your path. Audio generation needs NumPy, declared in `kit/audio/requirements.txt`; use a Python environment with those requirements installed. The kit's environment check reports missing tools. Browser paths must not be copied from another computer.

From this repository:

```sh
python3 kit/short.py init /path/to/my-short --name MyShort
cd /path/to/my-short
npm ci
python3 -m pip install -r .cartoon-kit/audio/requirements.txt
python3 .cartoon-kit/short.py doctor project.json
python3 .cartoon-kit/short.py check project.json
python3 .cartoon-kit/audio/mix.py project.json --out public/audio
python3 .cartoon-kit/short.py sync project.json
python3 .cartoon-kit/short.py preview project.json
```

The default initializer creates a working **drink → react → drop action study**, not a finished story or a fully styled new film. Replace its subject, approved script, world and staging before production. Follow [SKILL.md](SKILL.md) and [production.md](references/production.md); the detailed visual implementation remains in the worked examples. Supply `--voice /path/to/recording` at initialization to preserve a recording and derive its duration, or use `--example genghis` for the longer biography example. The private Genghis narration is not bundled.

Commands take a path to `project.json`, rather than its directory. Build audio and run `sync` after changing the event schedule, assets or mix; normal checks and previews reject stale attached audio. `check --structure-only` intentionally skips private narration/music readiness and cached audio checks. The preview command starts a local Remotion server and does not export a movie.

Keep narration, credentials, generated videos, dependency folders, caches, and private style-study media out of Git. Use a project-specific temporary directory on a drive with enough space for Remotion bundles. Do not sweep another project's caches or restart the user's applications to fix a preview.

## License

Code and documentation are MIT; see [LICENSE](LICENSE). Audio assets retain their individual licenses and source records. Only assets explicitly cleared for redistribution belong in the reusable bank. Private reference images and videos are not part of the distributable kit; removing them from a current tree does not remove copies from earlier Git history.
