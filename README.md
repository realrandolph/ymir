# Ymir

Ymir is a reusable browser application for cataloging and previewing Models,
Props, Materials, and named Colors. Its local editor writes catalog metadata.
Trinity supplies the built WebGL renderer; Ymir does not depend on Synesthesia.

The public repository and [GitHub Pages demo](https://realrandolph.github.io/ymir/)
contain the application, renderer resources, and the five smallest Model examples
by combined manifest and mesh size. The full working library remains outside this
repository. The Pages demo is read-only; the local app enables the editors.

## Run locally

```sh
npm ci
npm run browse
```

Open **http://127.0.0.1:4174/**. Search and filter the catalog, inspect models,
props and materials, change the viewing angle, or enable the turntable. Previews
use the installed Trinity package with actual meshes and shaders. `PORT=4180`
selects another port. The server binds to localhost, serves Ymir and its installed
Trinity package, and blocks hidden files and path escapes. Chrome/WebGL2 is needed
for previews. Browser QA scripts use Ymir-local Playwright and Vite dependencies.

## Layout

- `catalog.json`: searchable manifest index with stable, versioned IDs.
- `models/`: shared geometry manifests and mesh buffers. The public repository
  includes five small examples; other projects can supply their own Ymir library.
- `materials/`, `colors/`, and `effects/`: shader-suite resources for Trinity.
- `browser/`, `tools/`, and `test/`: viewer/editor, localhost server, and tests.

Ymir imports the built `trinity` package from the public
[Trinity repository](https://github.com/realrandolph/trinity), pinned to v1.2.2.
See [Trinity's format documentation](https://github.com/realrandolph/trinity/blob/master/FORMAT.md).

Use Trinity's `loadLibrary()` to resolve Ymir resources. Keep project placement,
track-specific bindings, captions, and choreography in the video project. Stage
asset snapshots separately when reproducible renders need them.

Run `npm test` for the Node test suite and `npm run build:pages` for the read-only
Pages distribution. GitHub Actions runs both on changes to `master` and deploys
Pages from that branch.

## Licensing

The five public Model examples are selected from workspace-generated geometry.
Their catalog metadata marks licensing as unverified; this repository represents
no ownership audit or redistribution license. Public access does not grant resale
rights. The repository contains no music, reference images, or footage.
