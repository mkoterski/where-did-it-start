import { useState, type Ref } from 'react';
import { formatCoordinates } from '../domain/coordinates';
import { EXAMPLE_LOCATIONS } from '../domain/defaults';
import type { PosterLayout } from '../domain/layout';
import type { LocationSelection, PosterConfig } from '../domain/types';
import { useGeocodingSearch, type ReverseState } from '../geocoding/useGeocoding';
import { useI18n } from '../i18n/i18n';
import { Section } from './controls';
import { CoordinateInputs } from './CoordinateInputs';
import { InteractiveMap, type InteractiveMapHandle } from './InteractiveMap';
import { LocationSearch } from './LocationSearch';

interface LocationSectionProps {
  config: PosterConfig;
  layout: PosterLayout;
  mapRef: Ref<InteractiveMapHandle>;
  reverseState: ReverseState;
  onSelect(location: LocationSelection): void;
  onPick(latitude: number, longitude: number, final?: boolean): void;
  onZoomChange(zoom: number): void;
}

type GeoState = { status: 'idle' } | { status: 'locating' } | { status: 'error'; denied: boolean };

export function LocationSection({
  config,
  layout,
  mapRef,
  reverseState,
  onSelect,
  onPick,
  onZoomChange,
}: LocationSectionProps) {
  const { t } = useI18n();
  const { state, search, clear } = useGeocodingSearch();
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const location = config.location;
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const useMyLocation = () => {
    setGeo({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({ status: 'idle' });
        onPick(position.coords.latitude, position.coords.longitude);
      },
      (error) => setGeo({ status: 'error', denied: error.code === error.PERMISSION_DENIED }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <Section title={t('location.title')} description={t('location.description')}>
      <LocationSearch state={state} onSearch={search} onSelect={onSelect} onClear={clear} />

      {!location ? (
        <div className="examples">
          <p className="field__hint">{t('location.examples')}</p>
          <div className="examples__list">
            {EXAMPLE_LOCATIONS.map((example) => (
              <button
                key={example.label}
                type="button"
                className="button button--chip"
                onClick={() => onSelect(example.location)}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <InteractiveMap
        ref={mapRef}
        config={config}
        layout={layout}
        onPick={onPick}
        onZoomChange={onZoomChange}
      />

      <div className="location-summary" aria-live="polite">
        {location ? (
          <>
            <p className="location-summary__place">
              {reverseState.status === 'loading'
                ? t('location.lookingUp')
                : location.displayName || t('location.selectedPoint')}
            </p>
            <p className="location-summary__coords">
              {formatCoordinates(location.latitude, location.longitude, 'decimal', 6)}
            </p>
            {reverseState.status === 'error' ? (
              <p className="field__error">{t('location.lookupFailed')}</p>
            ) : null}
          </>
        ) : (
          <p className="location-summary__place">{t('location.none')}</p>
        )}
      </div>

      <details className="subsection">
        <summary>{t('location.moreOptions')}</summary>
        <CoordinateInputs
          key={location ? `${location.latitude},${location.longitude}` : 'empty'}
          latitude={location?.latitude ?? null}
          longitude={location?.longitude ?? null}
          onApply={(latitude, longitude) => onPick(latitude, longitude)}
        />
        {canLocate ? (
          <div className="geolocate">
            <button
              type="button"
              className="button"
              onClick={useMyLocation}
              disabled={geo.status === 'locating'}
            >
              {geo.status === 'locating' ? t('location.locating') : t('location.useMyPosition')}
            </button>
            <p className="field__hint">{t('location.geoHint')}</p>
            {geo.status === 'error' ? (
              <p className="field__error" role="alert">
                {geo.denied ? t('location.geoDenied') : t('location.geoFailed')}
              </p>
            ) : null}
          </div>
        ) : null}
      </details>

      <p className="attribution-note">{t('location.searchAttribution')}</p>
    </Section>
  );
}
