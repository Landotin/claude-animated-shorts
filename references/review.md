# Review, delivery, and reproducibility

Use three separate evidence categories: **technical validation**, **watched picture**, and **listened audio**. Each has a status, scope, tool/surface, and result. A source audit is useful evidence but cannot be recorded as listening. A screenshot cannot establish continuous movement.

## Minimum gates

| Gate | Pass criteria | Evidence to retain |
|---|---|---|
| Contract | Correct subject/composition; approved script/voice; recording hash/duration match; fps/dimensions; captions, sound and delivery settings explicit | Contract validation, source hashes, pending decisions |
| Timeline | Shots cover the intended duration; events are in range, uniquely identified, and tied to the correct actor/target; dependent cues consume the same frames | `python3 kit/short.py check TARGET/project.json`, cue list, timing diff |
| Assets | Local files exist; declared hashes match; licenses/provenance permit use; no private/uncleared material published | Asset ledger and check results |
| Picture | Verbs are visible, grip/contact/release align, carried objects have support, identity persists, expressions read at portrait size | Watched shot/time ranges and observed result |
| Seek safety | Forward playback, direct seek, backward seek and reload produce the same pose/events | Target frames/events and comparison result |
| Audio | Correct meaning and emotion, audible at the visible action, speech clear, blinks restrained, no clicks/clipping, ending intentional | Listened ranges, cue corrections, mix measurements |
| Preview/delivery | Requested composition opens and plays; export only if authorized | Working local URL or permitted output, unresolved limits |

Do not reduce the action gate to “an actor, prop and SFX exist.” Watch whether the actor actually grips, drinks, fastens, hits or transfers the prop. In a poisoning sequence, watch the sip through the sick response. In a robbery, follow the stolen object out. For a promotion, verify the same face before/after and the leader's approval before the rank change.

## Focused review order

1. Check contract and environment before spending time on detailed art. Run `doctor`, project validation, and the project's type/build checks. Use a supported browser configuration rather than another computer's executable path.
2. Review the first 13 seconds, every contact/release, key expression change, transition, and ending in live playback. Review at actual portrait framing, then inspect anchors more closely where needed.
3. Listen once with narration for clarity and feeling, then isolate Foley/reactions where meaning is uncertain. Listen around cue attacks and tails, not just at the nominal timestamp. Check quiet playback and the densest overlap.
4. Compare a few representative visual frames with the numeric baseline in `look.md`. Keep style work separate from an action/contact defect so an attractive frame does not conceal a missing verb.
5. Recheck only the changed beat and dependent transitions first. Run broader regression review when a shared clock, renderer, actor, mix path or global style changed.

The Genghis revision set is a regression checklist: poisoning/drinking, stolen possessions, rock/rat contact, root pulling, collar fastening, guard strike, beggar fight→approval→same-identity promotion, supported vases, execution→sack handoff→dispatch, shock/strained intake, anger, and visible principal blinks. The exact times belong to that project, not the generic kit.

An independent focused reviewer is useful for new action recipes or broad changes. Give them the approved brief, relevant event/shot IDs, actual preview/output evidence, and one review question. Ask for concrete defects and frame/time references. The implementer still resolves and checks the changes. Any capable reviewer or human can do this; do not block progress on a particular provider, model, or “max” setting. If no independent review is available, record that limit honestly.

## Preview-only delivery

When the user says not to render, neither movies nor still renders are allowed. Start the configured Remotion server with `python3 kit/short.py preview TARGET/project.json` and return the composition URL. Live UI screenshots, source checks, and non-export audio analysis may support review when permitted. Do not invoke a rendering helper to get around the boundary.

Before audio review, build the mix and run `sync` so the named Remotion tracks point to the current final-gain stems. Normal `check` and `preview` verify the mix cache when attached audio exists; a changed event frame, source, mixer or mix setting requires regeneration. A source-only handoff can use `check --structure-only`; record that media/cache readiness remains unverified.

If WebGL fails, distinguish an app/browser context failure from a composition exception. Preserve the work and diagnostics. Try an already available supported preview surface without killing the user's applications or changing global graphics settings. If no working surface is available, report that visual playback remains unverified; a successful typecheck is not a replacement.

Keep a durable review entry with what was actually watched/listened and what remains unverified. A working server URL does not imply a reviewed video.

## Export only when requested

Confirm the contract's output dimensions, duration, codec, scale and loudness target. The historical bridge delivery was 1440×2560 using a 1080×1920 composition scaled by 1.3333; it is a configurable delivery option, not a requirement for all projects.

Use one declared audio delivery route. Remotion can contain audio when the composition includes it; do not assume it always produces a silent track. If muxing a separate approved mix, explicitly select the intended video stream and that mix, avoid duplicating composition audio, and check final alignment/duration.

After an authorized export, inspect the output for duration, resolution, audio channels, blank/frozen/pop frames at edits, peak/loudness, and lip/contact timing. Review the final file as well as the preview because audio gain support and rendering paths can differ. The legacy `templates/scripts/short_qa.py` targets rendered media; it does not certify a preview-only project and may require adaptation to the current project metadata.

## Make reproducibility measurable

Use a fresh project and a held-out brief with a different subject, length, location and combination of actions. Include at least one held object, contact/release, emotional close-up and quiet ending. Run it using the kit and documented environment without borrowing unrecorded fixes from the example.

Record assistant/model/version when available, input brief, runtime/dependencies, contract/events, missing assets, validation results, human interventions and review findings. Success means the correct story, retained voice, readable actions, synchronized appropriate sound, deterministic seeking and the requested delivery boundary. Passing file/schema tests alone is insufficient.

For smaller-model evaluation, use the same brief and rubric for each attempt, keep a fixed intervention budget, and count corrections and completed gates. Do not report a frontier-independent success rate or promise equivalent quality without such runs. A dry run establishes only that the instructions/tools could be followed in that specific attempt.

## Revision and completion record

Track request → shot/event IDs → change → affected outputs → validation → actual watched/listened evidence → unresolved items. Store this alongside the project rather than in conversation memory alone. Hash/version audio sources and cache keys so the preview cannot silently play a stale stem after a revision.

Completion requires current outputs and checks consistent with the contract. Summarize what changed, how it was checked, the preview/output link, and material remaining limits. Do not label an unlistened mix “fully audited,” an unrendered project “final export,” or a single successful example “proven for every model.”
