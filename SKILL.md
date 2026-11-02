---
name: cartoon-3d-short
description: Create and revise narrated vertical cartoon stories with flat bean-head characters in a painted, ink-outlined 3D world using three.js and Remotion. Includes a portable project contract, shared action/sound events, expressive Foley, and preview-first review. Use for the bridge-short style, cartoon history/science stories, or requests to use the cartoon short skill. Preserve supplied narration and its duration; the format also supports longer stories.
---

# Cartoon 3D story short

Use the reusable kit rather than copying the bridge's subject, timing, or machine paths. The visual baseline is **The Bridge That Fell for a Song**; the Genghis Khan revisions establish the action and sound requirements below. This workflow is model-neutral. Reliability with smaller models must be measured; do not claim it has been proven by an unrun evaluation.

## Start or resume

1. Read the user's latest instructions and the project's contract and revision ledger. A request to analyze or propose changes authorizes analysis only. Preserve accepted edits and pending constraints across turns.
2. For a new project run `python3 kit/short.py init TARGET --name NAME` and install its locked Node dependencies with `npm ci` inside TARGET. This creates an action study to adapt, not an automatically finished story. Read `kit/project.schema.json` and the examples in `kit/examples/` before editing its contract. Run `python3 kit/short.py doctor TARGET/project.json` to check the environment.
3. Record subject, narrative mode, approved script, supplied voice path/hash/duration, dimensions, fps, captions/language, sound profile, review status, and delivery mode. Defaults: English, no captions or labels, 1080×1920 at 30 fps, preview first. User instructions override defaults.
4. If supplied, the approved voice is authoritative. Preserve its file, delivery, pauses, and gain. Set duration from that recording, rounded up to a frame; never force it into 55–70 seconds. Without supplied audio, agree the script and voice before locking picture timing.

## Read only the relevant guides

| Task | Read |
|---|---|
| Story, shot/event planning, physical actions, portable build, revisions | [production.md](references/production.md) |
| Characters, world, camera, lighting, ink, lens, exact baseline values | [look.md](references/look.md) |
| Sound layers, asset choice, vocal reactions, mix, blink policy | The sound section of [production.md](references/production.md), then the kit's audio instructions/catalog |
| Technical checks, visual/audio review, delivery, fresh-brief evaluation | [review.md](references/review.md) |

## Required production rules

- **Show the verb.** Every narrated action needs a readable setup, movement, contact or release, and consequence. A static sick face does not show poisoning; a floating vase does not show carrying. Use the action recipes in `production.md`.
- **One event clock.** Author semantic events once. Picture poses, object anchors, impact graphics, camera accents, and SFX consume those same frame values through `kit/runtime/events.ts`. Do not duplicate timing constants in separate visual and audio scripts.
- **Make emotion audible.** Audit visible principal expressions and movements as well as impacts: breath, sip, strain, gasp, restrained anger, cloth, grips, and releases. Use the configured blink policy; avoid constant loud cartoon noises. Preserve speech clarity and intentional silence.
- **Deterministic playback.** Derive animation from the requested frame and seeded identity. No wall-clock animation, accumulating movement, random-per-render faces, or playback-triggered sound. Seeking backward must restore the same pose and audio schedule.
- **Verify what you claim.** A passing source check establishes structure, not convincing motion or sound. Record actual watched/listened ranges separately. Use a focused independent reviewer when available; no particular provider, model, or reasoning level is required.
- **Save reviewable state.** After each accepted change, update its event/shot, reason, affected outputs, validation evidence, and remaining issues. Regenerate only affected assets/stems; preserve unchanged approved assets.

## Delivery boundary

Commands below take the project JSON file. Build sound with `python3 kit/audio/mix.py TARGET/project.json --out TARGET/public/audio`, then run `python3 kit/short.py sync TARGET/project.json` to attach the final-gain stems. Run `python3 kit/short.py check TARGET/project.json` before preview; normal checks reject stale attached audio. Use `python3 kit/short.py preview TARGET/project.json` for the local Remotion server and return its composition URL. The generated project also contains these helpers under `.cartoon-kit/` for use from its own directory.

If the user says **do not render**, do not generate movie exports or still renders. Review through the live preview and source/audio checks that are permitted. Never silently switch to an export. An explicit export request can proceed through the export checklist in `review.md`; delivery size and loudness remain project settings.

The old `templates/bridge/`, `templates/audio/`, and `templates/scripts/` are a worked bridge example. Their bridge-specific duration, paths, camera and score events are not defaults for a new story. Private style-study frames or videos stay local; never publish them, copy their shots/scripts, or bundle them into a project.
