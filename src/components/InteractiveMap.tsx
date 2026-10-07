import { maplibregl } from './maplibre';
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { ZOOM_RANGE } from '../domain/defaults';
import { editorKeyholePixels, type PosterLayout } from '../domain/layout';
import { buildMapStyle, mapStyleOptions } from '../domain/mapStyle';
import { getShape, markerAnchor } from '../domain/shapes';
import type { MarkerShape, PosterConfig } from '../domain/types';

export interface InteractiveMapHandle {
  /** Animate the editor map to a point (e.g. after choosing a search result). */
  focusOn(latitude: number, longitude: number): void;
}

interface InteractiveMapProps {
  config: PosterConfig;
  layout: PosterLayout;
  /**
   * The spot was moved. `final` is false while the user is still dragging or nudging (live
   * preview) and true once they let go, which is when place details should be looked up.
   */
  onPick(latitude: number, longitude: number, final?: boolean): void;
  onZoomChange(zoom: number): void;
  ref?: Ref<InteractiveMapHandle>;
}

const WORLD_VIEW = { center: [10, 30] as [number, number], zoom: 1.2 };
const NUDGE_PX = 4;
/** How much closer than the linked view the precise placement mode zooms in. */
const PRECISE_ZOOM_STEP = 3;
const PRECISE_MAX_ZOOM = 20;
const COMMIT_DELAY_MS = 400;

type Direction = 'up' | 'down' | 'left' | 'right';
const NUDGES: Record<Direction, { delta: [number, number]; label: string; arrow: string }> = {
  left: { delta: [-1, 0], label: 'Move spot left', arrow: '←' },
  up: { delta: [0, -1], label: 'Move spot up', arrow: '↑' },
  down: { delta: [0, 1], label: 'Move spot down', arrow: '↓' },
  right: { delta: [1, 0], label: 'Move spot right', arrow: '→' },
};
const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, zoom));
}

function markerSvg(shape: MarkerShape, color: string): string {
  const def = getShape(shape === 'none' ? 'circle' : shape);
  const fill = shape === 'none' ? 'none' : color;
  const stroke = shape === 'none' ? color : '#fff';
  return (
    `<span class="editor-marker__icon">` +
    `<svg viewBox="-6 -6 112 112" aria-hidden="true" focusable="false">` +
    `<path d="${def.path}" fill="${fill}" fill-rule="${def.fillRule ?? 'nonzero'}" ` +
    `stroke="${stroke}" stroke-width="8" paint-order="stroke" stroke-linejoin="round"/></svg>` +
    `</span><span class="editor-marker__dot" aria-hidden="true"></span>`
  );
}

/** Pulse the marker until the user has moved it once, so it reads as something to grab. */
let markerHintDone = false;

/**
 * The editor map. Shows the same monochrome style as the poster (plus labels), a keyhole
 * overlay that matches exactly what the poster will show, and a draggable location marker.
 *
 * Zoom is shared with the poster: the editor runs `offset` zoom levels away from the poster
 * zoom so that the keyhole always has a comfortable on-screen size.
 */
export function InteractiveMap({ config, layout, onPick, onZoomChange, ref }: InteractiveMapProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const programmatic = useRef(false);
  const appliedStyleRef = useRef('');
  const draggingRef = useRef(false);
  const commitTimer = useRef<number | undefined>(undefined);
  const [keyhole, setKeyhole] = useState(320);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unsupported'>('loading');
  const [precise, setPrecise] = useState(false);
  const preciseRef = useRef(false);
  useEffect(() => {
    preciseRef.current = precise;
  }, [precise]);

  const { location, zoom } = config;
  const offset = Math.log2(keyhole / layout.frameExtent);
  const styleKey = JSON.stringify(mapStyleOptions(config, true));

  // Everything the imperative MapLibre handlers need, always current.
  const live = useRef({ config, layout, offset, onPick, onZoomChange });
  useEffect(() => {
    live.current = { config, layout, offset, onPick, onZoomChange };
  });

  /** Moves the keyhole cut-out so that the shape's anchor sits on the marker. */
  const updateOverlay = useCallback(() => {
    const map = mapRef.current;
    const svg = overlayRef.current;
    if (!map || !svg) return;
    const { config: current, layout: currentLayout } = live.current;
    const point = markerRef.current?.getLngLat();
    svg.style.display = point && current.location ? '' : 'none';
    if (!point || !current.location) return;
    const screen = map.project(point);
    const shape = getShape(current.frameShape);
    const scale = currentLayout.frame.scale * 2 ** (map.getZoom() - current.zoom);
    const transform = `translate(${screen.x - shape.anchor.x * scale} ${
      screen.y - shape.anchor.y * scale
    }) scale(${scale})`;
    svg.querySelectorAll('path').forEach((path) => {
      path.setAttribute('d', shape.path);
      path.setAttribute('transform', transform);
    });
  }, []);

  const runProgrammatic = (move: (map: maplibregl.Map) => void) => {
    const map = mapRef.current;
    if (!map) return;
    programmatic.current = true;
    move(map);
    if (!map.isMoving()) programmatic.current = false;
  };

  /** Called whenever the marker moved; the final commit is debounced for nudges. */
  const reportMove = useCallback((final: boolean) => {
    const point = markerRef.current?.getLngLat();
    if (!point) return;
    window.clearTimeout(commitTimer.current);
    if (final) {
      live.current.onPick(point.lat, point.lng, true);
      return;
    }
    live.current.onPick(point.lat, point.lng, false);
    commitTimer.current = window.setTimeout(
      () => live.current.onPick(point.lat, point.lng, true),
      COMMIT_DELAY_MS,
    );
  }, []);

  /** Moves the marker by a few screen pixels (arrow keys and nudge buttons). */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      const map = mapRef.current;
      const marker = markerRef.current;
      if (!map || !marker) return;
      markerHintDone = true;
      marker.getElement().classList.remove('editor-marker--hint');
      const screen = map.project(marker.getLngLat());
      marker.setLngLat(map.unproject([screen.x + dx, screen.y + dy]));
      updateOverlay();
      reportMove(false);
    },
    [updateOverlay, reportMove],
  );

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  useImperativeHandle(ref, () => ({
    focusOn(latitude, longitude) {
      setPrecise(false);
      preciseRef.current = false;
      runProgrammatic((map) =>
        map.flyTo({
          center: [longitude, latitude],
          zoom: live.current.config.zoom + live.current.offset,
          duration: 1400,
          essential: true,
        }),
      );
    },
  }));

  // Create the map.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: maplibregl.Map;
    try {
      const initial = live.current.config.location;
      map = new maplibregl.Map({
        container,
        style: buildMapStyle(JSON.parse(styleKey)),
        center: initial ? [initial.longitude, initial.latitude] : WORLD_VIEW.center,
        zoom: initial ? live.current.config.zoom + live.current.offset : WORLD_VIEW.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        renderWorldCopies: true,
      });
    } catch {
      // MapLibre throws synchronously when WebGL is unavailable; there is no event to wait for.
      // oxlint-disable-next-line react/set-state-in-effect
      setStatus('unsupported');
      return;
    }
    mapRef.current = map;
    appliedStyleRef.current = styleKey;
    map.getCanvas().setAttribute('aria-label', 'Editor map');
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Keyhole overlay: dims everything outside the shape, outlines the shape.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'keyhole');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      `<defs><mask id="${uid}-mask"><rect width="100%" height="100%" fill="#fff"/>` +
      `<path fill="#000"/></mask></defs>` +
      `<rect class="keyhole__dim" width="100%" height="100%" mask="url(#${uid}-mask)"/>` +
      `<path class="keyhole__outline" fill="none" vector-effect="non-scaling-stroke"/>`;
    map.getCanvasContainer().appendChild(svg);
    overlayRef.current = svg;

    let loaded = false;
    map.on('load', () => {
      loaded = true;
      setStatus('ready');
      // Start with the compact attribution collapsed so it does not cover the map.
      container
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show');
    });
    // Before the first load an error means the style/tiles are unreachable. Later, single
    // tile failures are tolerable in the editor; the export reports them explicitly.
    map.on('error', () => {
      if (!loaded) setStatus('error');
    });
    map.on('move', () => updateOverlay());
    map.on('moveend', () => {
      programmatic.current = false;
    });
    map.on('zoom', () => {
      const { config: current, offset: currentOffset } = live.current;
      // In precise placement mode the editor zooms independently of the poster.
      if (programmatic.current || preciseRef.current || !current.location) return;
      const next = clampZoom(map.getZoom() - currentOffset);
      if (Math.abs(next - current.zoom) > 0.001) live.current.onZoomChange(next);
    });
    map.on('click', (event) => live.current.onPick(event.lngLat.lat, event.lngLat.lng, true));

    const observer = new ResizeObserver(() => {
      map.resize();
      setKeyhole(editorKeyholePixels(container.clientWidth, container.clientHeight));
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // The map instance lives for the lifetime of the component.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restyle when colours or line settings change.
  useEffect(() => {
    if (!mapRef.current || appliedStyleRef.current === styleKey) return;
    appliedStyleRef.current = styleKey;
    mapRef.current.setStyle(buildMapStyle(JSON.parse(styleKey)), { diff: true });
  }, [styleKey]);

  // Keyhole colours follow the poster palette.
  useEffect(() => {
    const svg = overlayRef.current;
    if (!svg) return;
    svg.style.setProperty('--keyhole-paper', config.posterBackground);
    svg.style.setProperty('--keyhole-ink', config.mapInk);
  }, [config.posterBackground, config.mapInk]);

  // Marker: (re)create when its look changes, move when the location changes.
  const markerShape = config.markerShape;
  const markerColor = config.markerColor;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    const current = live.current.config.location;
    if (!current) {
      updateOverlay();
      return;
    }

    const element = document.createElement('button');
    element.type = 'button';
    element.className = `editor-marker editor-marker--${markerShape}${
      markerHintDone ? '' : ' editor-marker--hint'
    }`;
    element.setAttribute(
      'aria-label',
      'Selected location. Drag it, or use the arrow keys to move it (hold Shift for larger steps).',
    );
    element.innerHTML = markerSvg(markerShape, markerColor);

    // The icon is 36px inside a 48px grab area (6px padding); 36px / 112 viewBox units.
    const unitPx = 36 / 112;
    const anchorPoint = markerAnchor(markerShape);
    const marker = new maplibregl.Marker({
      element,
      draggable: true,
      clickTolerance: 2,
      anchor: markerShape === 'pin' ? 'bottom' : 'center',
      offset:
        markerShape === 'pin'
          ? [0, 6 + (106 - anchorPoint.y) * unitPx]
          : [0, (50 - anchorPoint.y) * unitPx],
    })
      .setLngLat([current.longitude, current.latitude])
      .addTo(map);

    // Live preview while dragging, throttled to one update per frame.
    let frame = 0;
    marker.on('dragstart', () => {
      draggingRef.current = true;
      markerHintDone = true;
      element.classList.remove('editor-marker--hint');
      element.classList.add('is-dragging');
    });
    marker.on('drag', () => {
      updateOverlay();
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        reportMove(false);
      });
    });
    marker.on('dragend', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      draggingRef.current = false;
      element.classList.remove('is-dragging');
      reportMove(true);
    });

    element.addEventListener('click', (event) => event.stopPropagation());
    element.addEventListener('keydown', (event) => {
      const direction = ARROWS[event.key];
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? NUDGE_PX * 5 : NUDGE_PX;
      nudge(direction[0] * step, direction[1] * step);
    });

    markerRef.current = marker;
    updateOverlay();
    return () => cancelAnimationFrame(frame);
  }, [markerShape, markerColor, location === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow location changes (search, typed coordinates, drag) without fighting the user.
  const previousLocation = useRef(location);
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const wasEmpty = previousLocation.current === null;
    previousLocation.current = location;
    if (!map || !location) return;
    marker?.setLngLat([location.longitude, location.latitude]);
    if (wasEmpty) {
      runProgrammatic((m) =>
        m.flyTo({
          center: [location.longitude, location.latitude],
          zoom: live.current.config.zoom + live.current.offset,
          duration: 1400,
          essential: true,
        }),
      );
    } else if (
      !draggingRef.current &&
      !map.getBounds().contains([location.longitude, location.latitude])
    ) {
      runProgrammatic((m) => m.easeTo({ center: [location.longitude, location.latitude] }));
    }
    updateOverlay();
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the editor zoom in sync with the poster zoom (slider, shape size, map resize),
  // except in precise placement mode, where the editor zooms in on its own.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    if (precise) {
      map.setMaxZoom(PRECISE_MAX_ZOOM);
      return;
    }
    map.setMinZoom(Math.max(0, ZOOM_RANGE.min + offset));
    map.setMaxZoom(Math.min(22, ZOOM_RANGE.max + offset));
    const target = zoom + offset;
    if (!map.isMoving() && Math.abs(map.getZoom() - target) > 0.01) {
      runProgrammatic((m) =>
        m.easeTo({
          zoom: target,
          around: [location.longitude, location.latitude],
          duration: 0,
        }),
      );
    }
    updateOverlay();
  }, [zoom, offset, location, precise]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateOverlay();
  }, [config.frameShape, layout.frame.scale, updateOverlay]);

  const recenter = () => {
    if (!location) return;
    setPrecise(false);
    runProgrammatic((map) =>
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: zoom + offset,
        duration: 900,
      }),
    );
  };

  const togglePrecise = () => {
    if (!location) return;
    const next = !precise;
    preciseRef.current = next;
    setPrecise(next);
    runProgrammatic((map) =>
      map.easeTo({
        center: [location.longitude, location.latitude],
        zoom: next ? Math.min(PRECISE_MAX_ZOOM, zoom + offset + PRECISE_ZOOM_STEP) : zoom + offset,
        duration: 700,
      }),
    );
  };

  return (
    <div className="interactive-map-block">
      <div className="interactive-map" ref={wrapperRef}>
        <div
          ref={containerRef}
          className="interactive-map__canvas"
          role="application"
          aria-label="Map. Click to place the location, drag to pan, scroll or use + and − to zoom."
        />
        {location ? (
          <button type="button" className="map-chip interactive-map__recenter" onClick={recenter}>
            Re-center
          </button>
        ) : (
          <p className="map-chip interactive-map__hint">
            Click anywhere on the map to place your spot
          </p>
        )}
        {location && precise ? (
          <p className="map-chip interactive-map__precise-note" role="status">
            Precise placement · the poster zoom stays as it is
          </p>
        ) : null}
        {status === 'loading' ? (
          <p className="interactive-map__status" role="status">
            Loading map…
          </p>
        ) : null}
        {status === 'error' ? (
          <p className="interactive-map__status interactive-map__status--error" role="alert">
            The map could not be loaded. Check your connection and reload the page.
          </p>
        ) : null}
        {status === 'unsupported' ? (
          <p className="interactive-map__status interactive-map__status--error" role="alert">
            Your browser cannot display the interactive map (WebGL is unavailable). You can still
            search for a place or type coordinates.
          </p>
        ) : null}
      </div>
      {location && status !== 'unsupported' ? (
        <div className="map-tools">
          <p className="map-tools__hint">
            <strong>
              Drag the{' '}
              {markerShape === 'none' ? 'marker' : getShape(markerShape).label.toLowerCase()}
            </strong>{' '}
            or click the map to move your spot. Use the arrows for small steps.
          </p>
          <div className="map-tools__row">
            <button
              type="button"
              className={`button button--small map-tools__precise${precise ? ' is-active' : ''}`}
              aria-pressed={precise}
              onClick={togglePrecise}
            >
              {precise ? 'Done' : 'Precise placement'}
            </button>
            <div
              className="map-tools__nudge"
              role="group"
              aria-label="Move the spot in small steps"
            >
              {(Object.keys(NUDGES) as Direction[]).map((direction) => {
                const { delta, label, arrow } = NUDGES[direction];
                return (
                  <button
                    key={direction}
                    type="button"
                    className="button button--icon"
                    aria-label={label}
                    title={label}
                    onClick={() => nudge(delta[0] * NUDGE_PX, delta[1] * NUDGE_PX)}
                  >
                    <span aria-hidden="true">{arrow}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
