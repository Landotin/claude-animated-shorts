# Production contract, actions, and sound

Read [look.md](look.md) for visual settings and [review.md](review.md) for acceptance evidence. Use `kit/project.schema.json`, its examples, and the kit commands as the executable contract; the prose here explains the editorial decisions.

## Lock the brief before the timeline

Record the correct subject and approved script before selecting a template. Name the composition and project after that subject. An old Beowulf or bridge composition must not silently become the new story.

Choose the structure that fits the approved material:

- **Event story:** paradox/hook → setting → escalation → physical turning point → consequence → callback. An everyday analogy helps only when it explains the mechanism.
- **Biography:** immediate stakes → survival/formation → reversals → decisive choices → consequences → legacy. Preserve age, identity, and cause across time jumps.
- **Explanation:** question → visible mechanism → comparison or test → conclusion. Explain unfamiliar terms in plain speech.

The bridge's deadpan double line, march score, 67-second length, and analogy are options rather than requirements. Do not add jokes or rewrite a user's complete script without authorization. Source new factual claims when researching; flag a material conflict with the supplied script instead of silently presenting invented facts.

For supplied narration, retain the original file and hash. Measure its actual duration and derive the composition length using `ceil(seconds × fps)`, with any approved tail represented explicitly. Store word timings as a separate asset and correct important action words manually. A written timestamp is a cue to inspect; the recording and visible action determine the final event frame.

## Plan events, then shots

Before drawing a world, write the visible proof for each clause: actor, action, object, target, result, and emotion. Split a clause when one shot cannot show its verbs clearly. A still of a rat followed by roots is insufficient for “hunt rats and dig up roots.” Plan a rock release/contact and a separate grip/pull/release.

Each important event has a stable ID and a frame on the project clock. Include the actor/target or prop, action phase, visual consequence, and associated audio cue or deliberate omission. Shots reference events; camera accents and effects consume them. Use the shared event helper in `kit/runtime/events.ts` rather than copying second/frame numbers into a second schedule.

Use one rounding rule at ingestion. Keep frame numbers authoritative after timing lock; do not repeatedly round seconds in different modules. A timing revision changes the event once, then invalidates the picture/audio outputs that depend on it.

Action phases should span readable frames at the final portrait size: preparation → anticipation → movement → contact/release → follow-through → reaction. Place contact within the action word's beat; an impact's sound attack belongs on contact, not automatically at the beginning of a file. A deliberate 0–3-frame visual lead can support a word, but never shifts every event earlier indiscriminately.

## Reusable action grammar

| Action | Required visible sequence | Contact and audio evidence |
|---|---|---|
| Drink, then poisoning | Hand grips cup → cup reaches lips → tip/sip → swallow → sick reaction → cup drops/father slumps | Cup stays attached until release; lip/sip cue, gulp or breath, strained nonverbal grunt, then cup/ground contact. Keep symptoms distinct from the drinking pose. |
| Rob a family | Intruder reaches → grips a recognisable possession → lifts → carries it away; family reacts | Transfer ownership visibly. Cloth/leather/coins match the item; steps follow movement; a distressed reaction supports the victim's face. |
| Throw a rock at a rat | Wind-up → hand release → visible flight → target contact → rat/rock consequence | Rock follows the hand until release. Align the contact graphic, body response, impact transient, and optional camera kick. Avoid a detached burst without a hit. |
| Pull roots | Crouch/reach → grip exposed root → strain → root breaks free with dirt → hold root | Root remains grounded before release and attached to the hand after it. Use earth scrape, strain, short release and scattered dirt, with a small relief breath if readable. |
| Fasten a collar | Soldier brings open iron/wood toward neck → closes/slaps halves → latch locks → captive recoils | Show the soldier's hand and collar contact in the same frame region. Snap/latch and a restrained grunt belong on fastening. A pre-existing collar alone cannot tell the action. |
| Strike a guard | Grip weapon → wind-up → weapon reaches head → guard reacts/falls → attacker follows through | Resolve the weapon endpoint to the head anchor at impact. Body movement and impact graphic establish the hit; sound reinforces it. Use stylised, non-graphic consequences. |
| Fight, then promote | Same beggar identity fights skillfully → opponents visibly lose → Khan approves → clothing/rank transforms → general commands | Preserve face/variant across the transformation. Show approval before promotion, then an earned short accent and material change. Changing to an unrelated general card loses the cause. |
| Carry/handoff cargo | Grip or saddle attachment → carried movement → receiving hand/basket contact → release | Parent cargo to its carrier while held; detach only at the transfer event. Vases must have hands, straps, baskets, or saddle supports. Foley follows those supports. |
| Messenger execution and sack dispatch | Establish messenger/governor → execution action and non-graphic collapse → sack handled → sack given to rider → rider departs → Khan receives/recoils | Separate death, preparation/transfer, and arrival. Do not make a floating sack stand for the missing actions. Use restrained strike, cloth/weight, handoff, hooves, drop, and shocked breath at their visible events. |

These are animation recipes, not permission to escalate graphic detail. Build narrative clarity with silhouette, framing, reaction, and props. Render hands, head and grip points through shared character anchors. Do not tune a floating prop separately in every camera. Keep a held prop in the actor's local space; convert the release anchor into world space once, deterministically.

Expressions also need phases: anticipation/attention → expression change → settle. A surprised face benefits from a small intake and body recoil; anger from jaw/shoulder tension and an exhale or grunt. Reuse a known face identity and vary its emotion. Do not substitute a camera shake for the missing body action.

## Sound design as a separate editorial pass

Create named, editable layers: **voice, Foley, reactions, accents, ambience, music**. Maintain cue IDs and their event IDs in the cue sheet. A measured mix and an attractive waveform do not establish that a cup sounds like drinking or that a grunt feels angry; auditioning is a separate gate.

1. **Foley/material:** footsteps, hooves, clothing, grips, cup/sip, leather, metal, wood, dirt, water, weapons, and cargo. Pick an actual recognizable source first; a synthetic thud cannot replace every material.
2. **Human reactions:** quiet crying/distressed breathing in abandonment; swallow and poisoned strain; robbed family's protest; effort when pulling/striking; Khan's approval, shock/intake, and anger. Use nonverbal clips that match age, emotion, and shot size. Avoid accidentally intelligible dialogue over the narrator.
3. **Accents:** short whooshes, glints, shock punctuation, promotion or scale reveals. These support a specific change; they do not fill every gap. Do not use one boing for grief, anger, blinking, and violence.
4. **Ambience:** wind, camp, water, city/fire, battle or desert space as appropriate. Crossfade changes in location and reduce it during intimate dialogue or a quiet ending.
5. **Music:** match the story's arc. Use ducking and intentional gaps around reveals; avoid copying the bridge march into a different emotional story by default.

For every close or medium principal-character shot, inspect expression changes, hand/prop events, weight shifts, and relevant blinks. For the Genghis opening, the coverage check includes crying, drinking, poisoned reaction, robbery handling/distress, rock contact, and root grip/pull/release. Check later anger near 40 seconds, shock near 77 seconds, and anger near 79 seconds against the actual frames; these times are regression examples, not timing defaults for other projects.

**Blink policy is a project setting.** When requested, add a soft eyelid tick/pop to visible principal blinks on their actual animation frames. Suppress it for tiny background people, closed/spiral/squeezed eyes, occlusion, or inaudible framing. Deathbed and grief scenes may need a softer variation or an explicit omission. Vary pitch/gain deterministically within restrained bounds. A global repeated “boing” track is not a blink pass.

## Assets and mixing

The reusable bank needs source URL, creator, license, local hash, trim/attack offset, semantic role, and variants. Bundle only assets whose license permits that redistribution. CC0 material with its provenance is suitable; a download being free does not establish redistribution rights. Keep uncleared material external and make missing assets fail clearly. Never bundle a supplied narrator's recording by default.

Prefer a small prepared bank over searching the internet again for every shot. Reuse a sip for another drink only if its tone fits; choose distinct metal, dirt, cloth, vocal, and accent families. Clip from validated offsets, apply short edge fades, and align the recognizable attack to the event. Deterministic variation avoids mechanical repetition while preserving seeking and rebuilds.

The established composition starting gains are **voice unchanged, SFX −6 dB, music +3 dB**. They describe track gain relative to the authored stems, not a universal loudness target. Calibrate source levels first, then duck/carve the other layers under speech. Do not normalize, compress, retime, or replace an approved voice silently. Preserve gain above unity in the preview's supported audio path and verify that preview and export use equivalent gain behavior.

Use the project's configured target and peak ceiling. Measure combined output, speech intelligibility, true peak/headroom, and tail length; avoid clipping by adjusting the music/effects or a declared non-voice bus rather than altering the original voice. Audition the opening, densest action, emotional close-ups, transitions, and ending at a normal listening level. Test modest playback volume and mono compatibility. Deliberate silence should remain silence.

Build through `python3 kit/audio/mix.py TARGET/project.json --out TARGET/public/audio`, then attach the stems with `python3 kit/short.py sync TARGET/project.json`. Generated stems already contain final gains; play them at unity and do not also play the original narration. These helpers are copied into `.cartoon-kit/` inside initialized projects. Keep the cue schedule, source/asset versions, and measured metrics with the build. If a visual contact moves, regenerate the affected audio from that same event. Do not edit a rendered mix's timestamp by hand while the event file remains stale. Normal project checks and previews fail when attached stems are stale or have not been synced.

## Portable, seek-safe construction

Use the project's composition ID, entry point, public folder, duration, fps, and dimensions throughout tooling. Discover or configure the browser through the supported runtime; never hardcode a Windows executable or a home-directory path. Retain a dependency lockfile and explicit supported runtime requirements.

Drive camera, bodies, expressions, materials, particles and sound placement from frame + seeded identity. Recompute pose after seeking rather than incrementing it each tick. Test the same contact by playing forward, seeking directly, seeking backward, and reloading. Dispose textures/materials/post-processing resources when a scene is released. Keep reusable Canvas/texture caches bounded.

Use a project-specific cache directory. Avoid rebuilding unchanged public assets, and check available space before bundling. Only delete known disposable files owned by this project while they are idle. A broken preview does not authorize killing browsers, restarting the desktop app, changing global graphics settings, or deleting shared temporary folders. Report a WebGL limitation and use an available supported preview surface.

## Save state and revise narrowly

The contract and revision ledger are durable handoff files. Record for each revision: request, stable shot/event IDs, previous acceptance, changed implementation/assets, invalidated outputs, checks performed, preview evidence, and remaining issues. Retain explicit constraints such as “preview only,” “voice unchanged,” or “captions off.”

Before editing, reproduce the reported beat and identify whether the problem is timing, pose/contact, framing, identity, missing sound, asset meaning, or mix. Fix its cause. A louder impact cannot repair an invisible strike. Regenerate affected stems and previews; preserve accepted shots and the approved voice. Update checks and hashes so a later assistant knows which outputs are current.

The existing bridge folders remain useful examples of the look and original score. Their shot count, 2025-frame length, score hits, old browser path, and mux assumptions are specific to that example. New work starts from the contract and event model, then adopts the proven visual implementation.
