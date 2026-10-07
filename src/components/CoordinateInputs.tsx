import { useId, useState, type ClipboardEvent } from 'react';
import { parseCoordinate, parseCoordinatePair } from '../domain/coordinates';

interface CoordinateInputsProps {
  latitude: number | null;
  longitude: number | null;
  onApply(latitude: number, longitude: number): void;
}

const show = (value: number | null) => (value === null ? '' : value.toFixed(6));

/**
 * Manual latitude/longitude entry. Pasting "48.171874, 11.563764" into either field fills
 * both. Remount (via `key`) to reset the drafts when the location changes elsewhere.
 */
export function CoordinateInputs({ latitude, longitude, onApply }: CoordinateInputsProps) {
  const id = useId();
  const [lat, setLat] = useState(show(latitude));
  const [lon, setLon] = useState(show(longitude));
  const [touched, setTouched] = useState(false);

  const parsedLat = parseCoordinate(lat, 'latitude');
  const parsedLon = parseCoordinate(lon, 'longitude');
  const latError =
    touched && parsedLat === null ? 'Latitude must be a number between −90 and 90.' : '';
  const lonError =
    touched && parsedLon === null ? 'Longitude must be a number between −180 and 180.' : '';

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(event.clipboardData.getData('text'));
    if (!pair) return;
    event.preventDefault();
    setLat(String(pair.latitude));
    setLon(String(pair.longitude));
  };

  return (
    <form
      className="coordinates"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (parsedLat !== null && parsedLon !== null) onApply(parsedLat, parsedLon);
      }}
    >
      <div className="coordinates__fields">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-lat`}>
            Latitude
          </label>
          <input
            id={`${id}-lat`}
            className="input"
            inputMode="decimal"
            value={lat}
            placeholder="48.171874"
            onChange={(event) => setLat(event.target.value)}
            onPaste={onPaste}
            aria-invalid={latError ? true : undefined}
            aria-describedby={latError ? `${id}-lat-error` : undefined}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-lon`}>
            Longitude
          </label>
          <input
            id={`${id}-lon`}
            className="input"
            inputMode="decimal"
            value={lon}
            placeholder="11.563764"
            onChange={(event) => setLon(event.target.value)}
            onPaste={onPaste}
            aria-invalid={lonError ? true : undefined}
            aria-describedby={lonError ? `${id}-lon-error` : undefined}
          />
        </div>
        <button type="submit" className="button coordinates__apply">
          Apply
        </button>
      </div>
      {latError ? (
        <p className="field__error" id={`${id}-lat-error`} role="alert">
          {latError}
        </p>
      ) : null}
      {lonError ? (
        <p className="field__error" id={`${id}-lon-error`} role="alert">
          {lonError}
        </p>
      ) : null}
    </form>
  );
}
