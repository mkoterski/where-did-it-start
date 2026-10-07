import { maplibregl } from './maplibre';
import { useEffect, useRef } from 'react';
import type { PosterLayout } from '../domain/layout';
import { buildMapStyle, mapStyleOptions } from '../domain/mapStyle';
import type { PosterConfig } from '../domain/types';

export type MapStatus = 'loading' | 'ready' | 'error';

interface PosterMapProps {
  config: PosterConfig;
  layout: PosterLayout;
  /** Device pixels per design unit, so the map stays crisp at any preview size. */
  pixelRatio: number;
  onStatusChange?: (status: MapStatus) => void;
}

/**
 * The map layer of the poster preview: a non-interactive MapLibre map rendered at design
 * size (1 unit = 1 CSS px) and centred on the selected location.
 */
export function PosterMap({ config, layout, pixelRatio, onStatusChange }: PosterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tileErrorRef = useRef(false);
  const appliedStyleRef = useRef('');
  const statusRef = useRef(onStatusChange);
  useEffect(() => {
    statusRef.current = onStatusChange;
  });

  const { location, zoom } = config;
  const styleKey = JSON.stringify(mapStyleOptions(config, false));
  const hasLocation = location !== null;
  const { mapView, mapArea } = layout;

  // Create the map once a location exists; later changes are applied by the effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasLocation) return;
    const map = new maplibregl.Map({
      container,
      style: buildMapStyle(JSON.parse(styleKey)),
      center: [0, 0],
      zoom: 1,
      interactive: false,
      attributionControl: false,
      pixelRatio,
      fadeDuration: 0,
    });
    mapRef.current = map;
    appliedStyleRef.current = styleKey;
    // The preview as a whole is described for assistive tech; its map canvas is decorative.
    map.getCanvas().removeAttribute('role');
    map.getCanvas().setAttribute('aria-hidden', 'true');
    statusRef.current?.('loading');
    map.on('dataloading', () => statusRef.current?.('loading'));
    map.on('error', () => {
      tileErrorRef.current = true;
      statusRef.current?.('error');
    });
    map.on('idle', () => statusRef.current?.(tileErrorRef.current ? 'error' : 'ready'));
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Recreating the map on every style/zoom change would be wasteful – see effects below.
  }, [hasLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!location) return;
    tileErrorRef.current = false;
    mapRef.current?.jumpTo({ center: [location.longitude, location.latitude], zoom });
  }, [location, zoom, hasLocation]);

  useEffect(() => {
    if (!mapRef.current || appliedStyleRef.current === styleKey) return;
    appliedStyleRef.current = styleKey;
    tileErrorRef.current = false;
    mapRef.current.setStyle(buildMapStyle(JSON.parse(styleKey)), { diff: true });
  }, [styleKey]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [mapView.width, mapView.height]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && Math.abs(map.getPixelRatio() - pixelRatio) > 0.05) map.setPixelRatio(pixelRatio);
  }, [pixelRatio]);

  if (!hasLocation) return null;

  return (
    <div
      className="poster-map"
      style={{ left: mapArea.x, top: mapArea.y, width: mapArea.width, height: mapArea.height }}
    >
      <div
        ref={containerRef}
        className="poster-map__canvas"
        style={{
          left: mapView.x - mapArea.x,
          top: mapView.y - mapArea.y,
          width: mapView.width,
          height: mapView.height,
        }}
      />
    </div>
  );
}
