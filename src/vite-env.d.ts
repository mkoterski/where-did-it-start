/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TileJSON URL of an OpenMapTiles-compatible vector tile source. */
  readonly VITE_MAP_TILEJSON_URL?: string;
  /** Glyph (font) URL template for map labels in the editor. */
  readonly VITE_MAP_GLYPHS_URL?: string;
  /** Base URL of a Nominatim instance (defaults to the public OSM instance). */
  readonly VITE_NOMINATIM_URL?: string;
  /** Contact e-mail sent to Nominatim, as recommended by its usage policy. */
  readonly VITE_NOMINATIM_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
