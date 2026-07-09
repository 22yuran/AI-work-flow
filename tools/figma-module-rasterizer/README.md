# Module Rasterizer

Figma plugin MVP for exporting a selected module as PNG and replacing the original layer in place.

## Install for development testing

1. Unzip the shared package.
2. Open the Figma desktop app.
3. Go to `Plugins -> Development -> Import plugin from manifest...`.
4. Select `manifest.json` from this folder.
5. Run `Module Rasterizer` from `Plugins -> Development`.

## Use

1. Select a `Frame`, `Component`, `Instance`, `Component Set`, or `Group`.
2. Choose an export scale.
3. Click `Download PNG` to export an image.
4. Click `Replace with PNG` to insert a PNG layer at the same position.

`Keep source hidden` keeps the original layer hidden after replacement. Turn it off if you want the source layer removed.

## Build from source

```bash
npm install
npm run build
```

