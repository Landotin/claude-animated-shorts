# Proven cartoon look

This is the measured baseline from the bridge implementation, preserved separately from story timing. The original implementation lives in `templates/bridge/`; adapt its layout, roles, period props and shot events to the new subject. A “colourful 3D world” alone does not reproduce this look.

Style-study videos and images are private local material. Never upload, publish, or send them. Never copy their scripts, characters or shot sequences. The written reports are optional measurement references, not a requirement to obtain private media before starting.

## Implementation and precise baseline

- **World:** three.js geometry, painted Canvas2D textures, two-tone shading, black world ink. Buildings have plinths, cornices, sills, hoods, door steps, chimneys and pots rather than plain boxes. Sky is saturated; fog matches the horizon. Characters receive scene light and cast ground shadows.
- **Characters:** flat camera-facing cards, a 600×1000 design canvas, soles at y=975. Use the `Pen` drawing API in `toon.ts`. Bean heads have h/w .94, eyes .26 W apart, dark-plum variable-width outlines, no blush, and a 14-expression library. Adults are about 3.5 head-heights tall; legs about 1.4 HH. Stick limbs are about .055 head-width, with ink-dot hands. Faces are near brightness .93 with no eye highlights.
- **Light, day:** azimuth 75°, elevation 48°; lit `[1.58,1.5,1.33]`, shade `[.30,.29,.36]`, lift `[.05,.06,.11]`. Cool tint belongs only in shade. Sky top `#3e7fd2` → horizon `#b8d0ec`; fog equals horizon, 25→300 m; saturation 1.08; about 15% blue haze past 60 m. Freeze the camera-relative sun for each shot.
- **Light, golden:** azimuth 6°, elevation 7°, low backlit sun; key toward `#FFB36B` ×1.5, violet-blue shade (facade approximately `#444380`). Sky `#ffc47c` → `#8a6f8a`; peach fog only past 50 m, sun disc `#ffcf9e` plus bloom. Contact blobs and real card shadows anchor characters.
- **Albedo:** muted brick, cream, ochre and terracotta houses, baseline heights 7/8.4/9.8 m. Warm grey/beige stone has about 35% less saturation than the initial storybook pass. Ochre wood deck C* approximately 51–58, with near-black seams. Iron is dark and desaturated. Avoid lemon buildings and lavender lit faces.
- **World ink:** baseline `#030303`, 5.1 px near 6 m → 3.3 px at 90 m, calibrated at 1080×1920. Creases ×.8 from 35°; depth jumps from 1%; fog tint .3 only at distance. Character cards use the `NOINK` layer and carry their own plum ink, typically `#241726` (measured range `#201628`–`#2f1d28`).
- **Depth of field:** cInf pixels at 1080 width: hook/river close-ups 15–16, close-ups 12–14, medium shots 10–12, park 7, golden sway 5, wides/aerials 0. Focus on the principal eyes, especially the front row. Never blur away the contact that explains an action.
- **Post stack:** world ink → lens pre-pass → lens main → bloom → NEUTRAL tone map → grade. Bloom threshold 1.0, intensity .5, 6 levels, radius .6; MSAA 4 for the quality baseline. Keep grain off. Every pixel-sized post parameter scales by output height /1920.
- **Animation:** walk bob 5% baseline (range 3–7%), lean 1–7°, planted .8 m stride; blinks every .5–2.3 seconds, about 4 frames. Blink timing must match the shared event clock if sounded. Tight contact shadow about .5 under feet with a sun-direction tail by day; golden rim is inner-only on head/torso, never an offset outer copy.
- **Camera:** cut on large spatial/story jumps, smootherstep glides over 18–40 frames, creeping holds. Bridge holds pushed .15–.35% per frame, up to .6% on punch words; use these as a checked baseline rather than an excuse to obscure acting. Rolls about 4–4.6°; impact kicks alternate sign and decay over 7 frames. Recognisable foreground props frame about a third of the shots. No handheld float.

## Measured targets versus presets

The written reference measurements and the final bridge presets are related but not identical. Judge the resulting frame, not just whether a constant matches. The source reports measured:

| Area | Reference target |
|---|---|
| Ink | About 3 px at 1080 width, near-black `#0b0a0c`, relatively constant at distance; silhouette, depth jumps and normal creases, without wall/floor seams or a horizon stroke |
| Day colour | Median luma about .57; non-ink p5 about .23; lit chroma C* p90 about 55; sky top about `#5e93d9`, horizon 1.28× brighter |
| Golden colour | Peach horizon `#ffd08a`, violet-blue shadows, backlit sun; no muddy brown shade |
| Depth | DOF on roughly a third of screen time for close-ups, medium shots and inserts; cInf 10–16 px at 1080; establishing/wide shots sharp |
| Atmospheric depth | Horizon-colour fog, 25→420 m day or 20→360 m golden |
| Motion | Smootherstep glides, peak at most about 25 px/frame at 720p; purposeful push-ins, 4–5° rolls, seven-frame impact kicks |

Historical bridge review scores improved from 5/3/4/5/4/7/4/6 to approximately 7/5–6/5–6/6/5–6/7/6–7/6–7 across day colour, golden colour, lighting, ink, textures, characters, depth, composition. These are historical review observations, not a certification of a new output.

## Implementation map

| Files in `templates/bridge/` | Responsibility |
|---|---|
| `story.ts` | Shot and camera plan, impact kicks, DOF, foreground |
| `lights.ts`, `shade.ts`, `world.ts` | Light presets, two-tone shading, sky/fog/river, frame-driven poses |
| `build.ts`, `paint.ts` | Period-specific world layout, textured materials and sight-line culling |
| `toon.ts`, `cast.ts`, `cardshade.ts` | Drawn characters, expressions, cards, scene lighting |
| `ink.ts`, `lensblur.ts`, `grade.ts`, `Bridge.tsx` | Post-processing and composition |

Keep cross-file contracts explicit: `NOINK`, light/look presets, focus/DOF and actor anchors must agree between the world, cards, effects and post stack. Do not copy every bridge camera into another geography.

## Readability and rendering traps

- A swing with one rope disappearing behind a child reads as a hanging. Use two ropes, a wide plank, a child between them and a clear A-frame on each end.
- Props less than about 2 m from the lens can become huge cropped blobs. Recheck their silhouettes after moving a camera. A cropped foreground bush can read as an unexplained green ball; remove or reframe it.
- Period props must be recognisable and correct. A red flag with a yellow star/diamond can imply Vietnam; the 1831 England bridge uses a St George's cross. Do not transfer that flag to a Mongolian story.
- Rails across a torso hide acting. The bridge used a lens about 2.5 m up so rails crossed legs. Solve the actual sight line in each new shot.
- Painted signs can turn grey-blue under side light; a sign that must be read may need an unlit face. Captions/labels remain off unless the project asks for them.
- An outer offset rim turns hats into picture frames. Use an inner rim confined to the head/torso.
- Kenney nature-kit materials can start teal; recolour by material name. Check lit and shadowed colour separately.
- World ink and blur merged into one effect can overwrite ink. Keep world ink as its own pass before blur. Exclude already outlined character cards from world ink.
- Inspect pixel-scaled post effects at the actual output size. R3F can clamp DPR; a preview/half-scale setting alone does not prove that the underlying buffer is half-size.
- Avoid cameras inside buildings. Cull or redesign blockers along the full camera path, then inspect the action's grip and impact anchors.
- Grain at 2.5% made the historical 2K export about 910 MB instead of about 250 MB and degraded delivery compression. The baseline has no grain.
- Flat holds can read as freezes; an unjustified continual push can also harm comprehension. Keep a subtle move when it supports the shot and judge the result in playback.

For a look comparison, score day/golden colour, lighting, ink, textures, characters, depth and composition separately. Report frame/shot IDs and a concrete defect, then change only the responsible layer. Use live preview captures when rendering is forbidden. Do not claim a still establishes motion quality.
