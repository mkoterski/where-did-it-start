import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppearanceSection,
  MarkerSection,
  ShapeSection,
  TextSection,
} from './components/DesignSections';
import { ExportPanel } from './components/ExportPanel';
import type { InteractiveMapHandle } from './components/InteractiveMap';
import { LocationSection } from './components/LocationSection';
import { PosterPreview } from './components/PosterPreview';
import type { ThemePreset } from './domain/defaults';
import { computeLayout } from './domain/layout';
import type { LocationSelection, PosterConfig } from './domain/types';
import { useReverseGeocoding } from './geocoding/useGeocoding';
import { usePosterState } from './state/usePosterState';

const UNDO_WINDOW_MS = 15_000;

export default function App() {
  const [config, dispatch] = usePosterState();
  const layout = useMemo(() => computeLayout(config), [config]);
  const mapRef = useRef<InteractiveMapHandle>(null);
  const [beforeReset, setBeforeReset] = useState<PosterConfig | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // The mobile "See poster" shortcut is only useful while the poster is off screen.
  useEffect(() => {
    const element = previewRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setPreviewVisible(entry.isIntersecting),
      {
        threshold: 0.15,
      },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const reverse = useReverseGeocoding((location) =>
    dispatch({ type: 'resolveLocation', location }),
  );
  const resolvePlace = reverse.resolve;

  const update = useCallback(
    (patch: Partial<PosterConfig>) => dispatch({ type: 'update', patch }),
    [dispatch],
  );

  const selectLocation = useCallback(
    (location: LocationSelection) => {
      dispatch({ type: 'selectLocation', location });
      mapRef.current?.focusOn(location.latitude, location.longitude);
    },
    [dispatch],
  );

  const pickPoint = useCallback(
    (latitude: number, longitude: number) => {
      dispatch({ type: 'moveLocation', latitude, longitude });
      resolvePlace(latitude, longitude);
    },
    [dispatch, resolvePlace],
  );

  const changeZoom = useCallback((zoom: number) => update({ zoom }), [update]);

  const reset = () => {
    setBeforeReset(config);
    dispatch({ type: 'reset' });
  };

  useEffect(() => {
    if (!beforeReset) return;
    const timer = window.setTimeout(() => setBeforeReset(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [beforeReset]);

  return (
    <div className="app">
      <a className="skip-link" href="#preview">
        Skip to poster preview
      </a>
      <header className="app-header">
        <svg className="app-header__mark" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 95 C40 86 2 61 2 31 C2 15 14 5 28.5 5 C39 5 46.5 11.5 50 19.5 C53.5 11.5 61 5 71.5 5 C86 5 98 15 98 31 C98 61 60 86 50 95 Z"
            fill="currentColor"
          />
        </svg>
        <div>
          <h1 className="app-header__title">Where it all began</h1>
          <p className="app-header__tagline">
            Turn the place your story started into a minimalist map poster.
          </p>
        </div>
      </header>

      <main className="workspace">
        <div className="editor" aria-label="Poster editor">
          <LocationSection
            config={config}
            layout={layout}
            mapRef={mapRef}
            reverseState={reverse.state}
            onSelect={selectLocation}
            onPick={pickPoint}
            onZoomChange={changeZoom}
          />
          <ShapeSection config={config} update={update} layout={layout} />
          <MarkerSection config={config} update={update} />
          <TextSection
            config={config}
            update={update}
            onLabelChange={(value) => dispatch({ type: 'setLocationLabel', value })}
            onUseAutomaticLabel={() => dispatch({ type: 'useAutomaticLabel' })}
          />
          <AppearanceSection
            config={config}
            update={update}
            onPreset={(preset: ThemePreset) => dispatch({ type: 'applyPreset', preset })}
          />
        </div>

        <div
          className="preview-pane"
          id="preview"
          ref={previewRef}
          tabIndex={-1}
          aria-label="Poster preview and download"
        >
          <PosterPreview config={config} layout={layout} />
          <ExportPanel
            config={config}
            onReset={reset}
            onUndoReset={
              beforeReset
                ? () => {
                    dispatch({ type: 'replace', config: beforeReset });
                    setBeforeReset(null);
                  }
                : undefined
            }
          />
        </div>
      </main>

      <a
        className="jump-to-preview"
        href="#preview"
        data-hidden={previewVisible}
        aria-hidden={previewVisible || undefined}
        tabIndex={previewVisible ? -1 : undefined}
      >
        See poster ↓
      </a>

      <footer className="app-footer">
        <p>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Tiles
          by <a href="https://openfreemap.org">OpenFreeMap</a> ·{' '}
          <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · Search by{' '}
          <a href="https://nominatim.org">Nominatim</a>
        </p>
        <p>Your design is saved in this browser only.</p>
      </footer>
    </div>
  );
}
