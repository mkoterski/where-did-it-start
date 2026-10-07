import { useState, type Ref } from 'react';
import { formatCoordinates } from '../domain/coordinates';
import { EXAMPLE_LOCATIONS } from '../domain/defaults';
import type { PosterLayout } from '../domain/layout';
import type { LocationSelection, PosterConfig } from '../domain/types';
import { geocoder } from '../geocoding/provider';
import { useGeocodingSearch, type ReverseState } from '../geocoding/useGeocoding';
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
  onPick(latitude: number, longitude: number): void;
  onZoomChange(zoom: number): void;
}

type GeoState = { status: 'idle' } | { status: 'locating' } | { status: 'error'; message: string };

export function LocationSection({
  config,
  layout,
  mapRef,
  reverseState,
  onSelect,
  onPick,
  onZoomChange,
}: LocationSectionProps) {
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
      (error) =>
        setGeo({
          status: 'error',
          message:
            error.code === error.PERMISSION_DENIED
              ? 'Location access was denied. You can search or click the map instead.'
              : 'Your position could not be determined. Please search instead.',
        }),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <Section title="1 · Location" description="Where did it all begin?">
      <LocationSearch state={state} onSearch={search} onSelect={onSelect} onClear={clear} />

      {!location ? (
        <div className="examples">
          <p className="field__hint">No idea where to start? Try one of these:</p>
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
                ? 'Looking up the place name…'
                : location.displayName || 'Selected point'}
            </p>
            <p className="location-summary__coords">
              {formatCoordinates(location.latitude, location.longitude, 'decimal', 6)}
            </p>
            {reverseState.status === 'error' ? (
              <p className="field__error">
                The place name could not be looked up. The coordinates are still correct.
              </p>
            ) : null}
          </>
        ) : (
          <p className="location-summary__place">No place selected yet.</p>
        )}
      </div>

      <details className="subsection">
        <summary>Enter coordinates or use your position</summary>
        <CoordinateInputs
          key={location ? `${location.latitude},${location.longitude}` : 'empty'}
          latitude={location?.latitude ?? null}
          longitude={location?.longitude ?? null}
          onApply={onPick}
        />
        {canLocate ? (
          <div className="geolocate">
            <button
              type="button"
              className="button"
              onClick={useMyLocation}
              disabled={geo.status === 'locating'}
            >
              {geo.status === 'locating' ? 'Locating…' : 'Use my current position'}
            </button>
            <p className="field__hint">
              Your browser asks for permission first. The position is only used to place the map.
            </p>
            {geo.status === 'error' ? (
              <p className="field__error" role="alert">
                {geo.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </details>

      <p className="attribution-note">{geocoder.attribution}</p>
    </Section>
  );
}
