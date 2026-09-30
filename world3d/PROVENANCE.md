# World 3D source provenance

- Base repository: `https://github.com/enuminous/Archimedes-Engine`
- Inspected base commit: `b1531d6668beed2afdc94bf18a6072ee3b30f679`
- Base `engine.js` blob: `5204393f3d050873f1be15dc263490596651369b`
- New kernel/version: `world3d/engine3d.js`, 0.2.0.
- The old 0.1.0 kernel and mathematical source are retained as a regression reference.
- The 3D field, five-feature observer, three-coordinate movement, probe contacts, renderer and interface are explicit extensions developed for this request with OpenAI Codex assistance.
- User project direction and supplied framework: Matthew Chenoweth Wright / Monolithic LLC.
- Existing `RIGHTS.md` remains authoritative for this package's stated rights position; no new license grant has been selected.

The runtime includes no external package, downloaded model, texture, font or graphics source. The original procedural geometry and GLSL shaders are in `renderer.js`. `preview.png` is an offscreen capture of those exact shaders and geometry. It is not a concept illustration or browser screenshot.

Reference: [Khronos WebGL specification](https://registry.khronos.org/webgl/specs/1.0/). Deployment reference: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). The repository's existing `actions/deploy-pages@v5` tag was verified through the official repository API; it was preserved.
