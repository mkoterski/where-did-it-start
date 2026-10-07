# Where it all began

A single-page app for creating a personalised **“where it all began…”** map poster: search for
the place your story started, frame it in a heart (or another shape), add your names and
download a print-ready PNG, PDF or SVG.

![Example poster: black-and-white map of Berlin around Potsdamer Platz in a heart, a red heart marker, “Where it all began…”, “Anita & Matthias” and “Berlin 52.50965°N 13.37603°E”](docs/example-poster.png)

## Features

- **Location search** with multiple results to choose from (keyboard navigable), plus
  click-to-place, manual latitude/longitude entry (pasting `48.17, 11.56` fills both fields) and
  "use my position".
- **Easy fine-tuning of the spot**: drag the heart (or pin) on the map and the poster follows
  live; the icon lifts while dragging and a dot marks the exact point. Use the ← ↑ ↓ → buttons or
  the arrow keys for small steps, and **Precise placement** to zoom in close without changing the
  poster's zoom.
- **Keyhole effect**: the map is revealed through a heart, circle, rounded square, diamond,
  hexagon or star. Outside the shape the map can be hidden, faded or fully visible. The editor
  map shows the same keyhole, anchored to the selected point, so what you see there is what is
  printed.
- **Marker** on the exact spot: heart, circle, pin, star, diamond or none, with colour, size,
  opacity, outline and shadow.
- **Text**: main phrase, names, place label (filled in from the selected place, editable),
  coordinates in decimal (`48.15838°N 11.50194°E`) or degrees/minutes/seconds, four title
  fonts, size and alignment.
- **Appearance**: colour presets, poster/map/text colours, water style, street contrast, line
  weight, buildings, paper size (A4, A3, 30×40, 50×70, square) and orientation.
- **Live preview** in an optional frame, **export** to PNG, PDF and SVG at 150 or 300 dpi.
- The design is **saved in the browser** automatically; **share links** encode the design in the
  URL; **reset** restores the defaults (keeping the place) and can be undone.

## Getting started

Requires Node.js 20.19+ (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Development server with hot reload                         |
| `npm run build`     | Type-check and build the static site into `dist/`          |
| `npm run preview`   | Serve the production build locally                         |
| `npm test`          | Unit and component tests (Vitest + Testing Library, jsdom) |
| `npm run lint`      | Lint with oxlint (warnings fail)                           |
| `npm run format`    | Format with Prettier (`format:check` only checks)          |
| `npm run typecheck` | TypeScript project check                                   |
| `npm run check`     | Everything above, as run in CI                             |

The build output is fully static and uses relative paths, so `dist/` can be hosted on any
static host or a sub-path such as GitHub Pages.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` checks, builds and publishes the app on every push to `main`
(or manually via **Actions → Deploy to GitHub Pages → Run workflow**). One-time setup: in the
repository, open **Settings → Pages** and set **Source** to **GitHub Actions**. The app is then
served at `https://<user>.github.io/<repository>/`.

## How it works

```
src/
  domain/        pure logic: config model & defaults, coordinates, shapes, poster layout,
                 map style, paper sizes, typography (all unit tested)
  state/         reducer + persistence (localStorage, share links)
  geocoding/     provider interface, rate-limited Nominatim client, React hooks
  components/    editor sections, interactive map, poster preview, export panel
  export/        off-screen high-resolution rendering, font embedding, file names
```

One `PosterConfig` object drives three renderers:

1. **Editor map** (`InteractiveMap`): MapLibre with the poster’s monochrome style plus labels,
   and an SVG keyhole overlay re-positioned on every map move. Its zoom is linked to the poster
   zoom with a fixed offset, so the keyhole always has a comfortable on-screen size.
2. **Poster preview** (`PosterPreview`): the poster is laid out in _design units_ (the short
   side is 1000 units, and 1 unit = 1 CSS pixel of the map at the poster zoom) and scaled to
   fit. It is a non-interactive MapLibre map centred on the location, with `PosterOverlay` on
   top: one SVG containing the keyhole mask, outline, marker and all text.
3. **Export** (`export/exportPoster.tsx`): renders the map off-screen at the same design size
   with `pixelRatio` = export scale, so the visible area and line weights match the preview.
   It then renders the _same_ `PosterOverlay` component to markup with the fonts embedded, so
   the text and shapes match the preview exactly.

## Map and geocoding providers

| Purpose    | Provider                                                     | Key needed |
| ---------- | ------------------------------------------------------------ | ---------- |
| Map tiles  | [OpenFreeMap](https://openfreemap.org) (OpenMapTiles schema) | No         |
| Map engine | [MapLibre GL JS](https://maplibre.org) (BSD-3)               | –          |
| Geocoding  | [Nominatim](https://nominatim.org) (OpenStreetMap)           | No         |

### Attribution and usage limits

- Map data is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available
  under the ODbL. Tiles are by OpenFreeMap, using the © OpenMapTiles schema. The editor map shows
  the attribution, and posters print a small credit line by default (“Print map attribution”
  toggle). Keep it on for posters that are shared, published or sold.
- The public Nominatim service has a strict
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/). The app follows it:
  - searches run only on submit, never as you type;
  - requests are spaced at least 1.1 s apart;
  - identical requests are cached and duplicate results are removed;
  - reverse look-ups after a click or drag are debounced.

  For production traffic, use your own Nominatim instance or another provider (see below), and
  consider setting a contact e-mail.

- OpenFreeMap is free and allows commercial use, but has no SLA. For high-traffic deployments,
  self-host the tiles or use a commercial OpenMapTiles-compatible provider.

### Environment variables

All are optional; copy `.env.example` to `.env.local` to set them. They are baked into the
static build, so **never put secret API keys here**. Proxy keyed services through your own
backend instead.

| Variable                | Default                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `VITE_MAP_TILEJSON_URL` | `https://tiles.openfreemap.org/planet`                        |
| `VITE_MAP_GLYPHS_URL`   | `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf` |
| `VITE_NOMINATIM_URL`    | `https://nominatim.openstreetmap.org`                         |
| `VITE_NOMINATIM_EMAIL`  | _(unset)_: contact address sent to Nominatim                  |

### Replacing the map provider

Any vector tile source in the **OpenMapTiles schema** (MapTiler, a self-hosted
[Planetiler](https://github.com/onthegomap/planetiler) build, …) works by changing
`VITE_MAP_TILEJSON_URL`. For a different schema (e.g. Protomaps), adapt the layer filters in
`src/domain/mapStyle.ts`. The style is generated in code so colours, contrast and line weight
can be controlled from the editor. The source must send CORS headers, or the export cannot read
the rendered map.

### Replacing the geocoder

Implement `GeocodingProvider` from `src/geocoding/types.ts` (`search` and `reverse`, both
returning `LocationSelection`s) and export it from `src/geocoding/provider.ts`. Nothing else
needs to change. `createRateLimiter` in `src/geocoding/rateLimiter.ts` can be reused.

## Adding a shape

1. Add the id to `FrameShape` and/or `MarkerShape` in `src/domain/types.ts`.
2. Add an entry to `SHAPES` in `src/domain/shapes.ts`:
   - an SVG `path` drawn in a 100 × 100 box;
   - its `anchor`: the point that sits on the selected location;
   - its tight `bbox`, used for layout.
3. List it in `FRAME_SHAPES` and/or `MARKER_SHAPES`.

The picker, editor keyhole, preview, export and the layout tests in
`src/domain/layout.test.ts` pick it up automatically.

## Export notes and limitations

- **PNG** is the most faithful output. **PDF** embeds the same image as a high-quality JPEG on a
  page of the selected paper size. **SVG** keeps text and shapes as vectors, with fonts
  embedded and the map as an embedded PNG. The map itself is not vector in the SVG.
- 300 dpi exports are capped at about 36 megapixels (for example, 50 × 70 cm is exported at
  ~212 dpi) so they work on most devices. Very old or low-memory phones may still fail at
  300 dpi; the app then shows an error and suggests Standard quality.
- Export needs WebGL and a working connection for the map tiles. If any tile fails to load, the
  export stops with a clear message rather than producing an incomplete poster.
- The frame around the preview is only a preview; it is not part of the exported file.
- Safari can render embedded web fonts in SVG images slightly later than other browsers. If the
  title appears in a fallback font, export again.

## Manual QA checklist

- [ ] Search “Brandenburger Tor”, pick a result with ↓/Enter; map flies there, poster updates.
- [ ] Click elsewhere on the map; marker moves and the place name/label update.
- [ ] Drag the heart: the poster follows while dragging, the place name updates after the drop.
- [ ] Nudge with the arrow buttons and the arrow keys (Shift for bigger steps).
- [ ] Precise placement: zooming does not change the "Map zoom" slider; Done returns to the
      linked view.
- [ ] Zoom the editor map; the “Map zoom” slider and poster follow (and vice versa).
- [ ] Switch each shape and outside mode; the keyhole stays on the location while panning.
- [ ] Edit title/names/label; counters update; long text shrinks to fit.
- [ ] Toggle coordinates, switch to DMS, change decimals.
- [ ] Apply the “Midnight” preset and landscape orientation.
- [ ] Export PNG, PDF and SVG in both qualities; files open and match the preview.
- [ ] Copy share link, open it in a private window; the design is restored.
- [ ] Reset design, then Undo reset.
- [ ] Narrow the window to phone width: stacked layout, “See poster” shortcut, no horizontal
      scrolling.
- [ ] Keyboard only: all controls reachable with visible focus.
