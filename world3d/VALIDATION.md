# World 3D validation — September 30, 2026

## Executed checks

`npm test` completed on Node **v24.19.0**: **56 passed, zero failed, zero skipped**. This includes the existing 22 two-dimensional engine tests and 10 two-dimensional UI-contract tests, plus:

- **18 three-dimensional engine/controller/geometry tests:** deterministic seeds and replay, movement along all axes, six-neighbor field transfer, reflecting-boundary mass accounting, uniform decay, parameter extremes, held observations, sphere/box contact, gravity and bounce, coupling ablation, bounded planning, counterfactual isolation, session round-trips, history branching/pruning, malformed imports, failed-mutation atomicity, stale forecasts and finite camera geometry.
- **6 three-dimensional UI-contract tests:** actual app handlers for run/pause/step, interventions, selection, action/coupling changes, future candidate selection and application, rewind, download/import and restored browser storage. These execute `world.js` with a DOM and renderer shim. They do not lay out CSS, execute a browser's WebGL implementation or exercise real pointer input.

`npm run experiment:3d` completed **16 synthetic developmental runs**, each 400 ticks, with all resulting worlds passing structural/bounds validation. The schedule, raw seed/coupling/intention results and replay hashes are in `results/world3d-experiment.json` and `results/WORLD3D-EXPERIMENT.md`. These are not independent external validation or a confirmatory study.

`python3 scripts/render-world3d.py` compiled and linked the **actual shipped GLSL shaders**, submitted the **actual generated 3D geometry**, and read back the rendered scene. Backend: **llvmpipe (LLVM 20.1.2, 256 bits)**. GL error: **0**. Scene checksum: **04b341ca**. `world3d/preview.png` was visually inspected: perspective, depth occlusion, building surfaces, stations, flying agents, field glyphs and trails were present. This is an offscreen graphics check, not a browser screenshot.

The standalone build is generated from the same source files and embeds all runtime JavaScript, CSS, icon and mathematics. Release packaging checks ZIP integrity, file hashes and embedded script syntax. No runtime CDN or npm package is required.

## Not established

- Full desktop/mobile browser layout and pointer/keyboard interaction review was not performed in the development environment. It remains a review item before treating the UI as production-ready.
- GPU/device/browser performance and local-file storage behavior vary. The app includes a WebGL-unavailable message, context-loss recovery and portable JSON export.
- The 3D model is not externally calibrated. Its field diffusion, contact rules, observer and planner weights are explicit assumptions, not a proof of EFMW physics, consciousness or AGI.
- There is no continuous collision detection, agent-agent/probe-agent/probe-probe contact, fluid mechanics, quantum dynamics, chemistry or arbitrary building editor.

## Suggested first browser review

Open `Archimedes-World3D.html` locally, then `/world3d/` through a static server. Inspect a desktop and narrow mobile viewport. Check orbit/pinch/follow/enter-world, field volume/slice, run/pause/step, intervention checkpoints, alternate path selection, rewind and save reload. Export before testing context loss or browser storage restrictions. Record any browser failure with the exported session, viewport, browser version and steps to reproduce.
