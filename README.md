# Postframe — photo editor for Instagram

A complete, pro-grade photo editor built specifically for preparing Instagram posts, carousels and stories.
Runs entirely in the browser (installable as an app on iPhone/Android/desktop); photos never leave the device.

## Features

**Instagram formats**
- Portrait 4:5 (1080×1350), Square 1:1, Tall 3:4 (1080×1440), Landscape 1.91:1 (1080×566), Story/Reel 9:16 (1080×1920), or keep original shape
- **Panorama carousels** – split one wide photo into up to 10 seamless slides
- **Borders** – fit the whole photo inside any format with a white/black/custom border (no cropping)
- Guides: rule of thirds, story safe zones, profile-grid 3:4 thumbnail preview
- Warnings when a crop will be cropped by Instagram or is low-resolution
- Export at exactly 1080 px (or 1440 px) wide, JPEG/PNG with quality control; Share sheet on mobile, multi-file download for carousels
- **Preview** as a feed post, in a profile grid, or as a story

**Editing** (real-time WebGL2 pipeline, identical math for preview and export)
- Crop with aspect presets, rotate 90°, flip, straighten (auto-zooms so corners never go empty)
- Light: exposure, brightness, contrast, highlights, shadows, whites, blacks (edge-aware local tone mapping)
- Color: temperature, tint, vibrance (skin-protecting), saturation
- HSL color mixer: hue / saturation / luminance for 8 color bands
- Tone curves: RGB + per-channel, monotone spline, presets
- Color grading: shadows / midtones / highlights wheels with balance & blending
- Detail & effects: texture, clarity, dehaze, sharpen, noise/skin smoothing, vignette (size/feather), film grain, fade
- 18 filters with strength control (filters are a base look; your adjustments stack on top)
- Auto enhance, saved presets (“My looks”) for a consistent feed
- Undo/redo history, hold-to-compare with the original, zoom/pan/pinch, live histogram with clipping indicators

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (geometry, curves, filters, crop)
npm run build      # type-check + production build into dist/
```

Shortcuts: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` redo, hold `\` to compare, `Ctrl/Cmd+E` export, double-click a slider to reset, double-click the photo to zoom.

## Architecture

- `src/engine/shaders.ts` – the single-pass GLSL adjustment shader + blur passes
- `src/engine/renderer.ts` – WebGL2 plumbing (textures, blur pyramid, LUT, offscreen export)
- `src/engine/pipeline.ts` – turns the edit state into shader uniforms
- `src/engine/geometry.ts` – crop / rotate / straighten / frame layout math
- `src/engine/curves.ts` – monotone cubic tone curves → LUT
- `src/presets/filters.ts` – filter looks and how they combine with manual edits
- `src/state/` – edit state model and the zustand store (with undo history)
- `src/components/` – React UI (viewport, crop tool, panels, export & preview dialogs)
