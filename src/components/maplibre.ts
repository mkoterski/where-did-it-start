import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre looks for its worker next to its own module file. Bundlers move that file, so the
// worker is emitted as a separate asset and its URL is set explicitly.
maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
