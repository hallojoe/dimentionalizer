# Third-party notes

The renderer uses Three.js and its OrbitControls addon, installed from npm. Three.js is MIT-licensed; its license is included in `node_modules/three/LICENSE` and preserved by the dependency distribution. The implementation adapts the visual concept and container layout of the owner's existing ChatGPT Sites explorer. No KMD logo, WorkZone descriptions, or proprietary branding assets are included.

Development tooling includes Vite, TypeScript, tsx, and TypeScript declarations for Three.js. Consult their installed package licenses and the lockfile for exact versions and transitive dependencies.

Fonts use local system fallbacks. No remote fonts or asset CDN is required at runtime.
