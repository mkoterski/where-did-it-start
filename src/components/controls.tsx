import { useId, type ReactNode } from 'react';

export function Section({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="section" open={defaultOpen}>
      <summary className="section__summary">
        <span className="section__title">{title}</span>
        {description ? <span className="section__description">{description}</span> : null}
      </summary>
      <div className="section__body">{children}</div>
    </details>
  );
}

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  maxLength: number;
  placeholder?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <span className="field__counter" id={`${id}-count`} aria-live="polite">
          {value.length}/{maxLength}
          <span className="visually-hidden"> characters</span>
        </span>
      </div>
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-count${hint ? ` ${id}-hint` : ''}`}
        autoComplete="off"
      />
      {hint ? (
        <div className="field__hint" id={`${id}-hint`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <output className="field__value" htmlFor={id}>
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="toggle">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle__input"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
      <label htmlFor={id} className="toggle__label">
        <span className="toggle__track" aria-hidden="true" />
        <span>{label}</span>
      </label>
      {description ? (
        <p className="field__hint toggle__description" id={`${id}-desc`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** A radio group rendered as buttons. Every option has a visible text label. */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  variant = 'segmented',
}: {
  legend: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange(value: T): void;
  variant?: 'segmented' | 'tiles';
}) {
  const name = useId();
  return (
    <fieldset className={`choice choice--${variant}`}>
      <legend className="field__label">{legend}</legend>
      <div className="choice__options">
        {options.map((option) => (
          <label key={option.value} className="choice__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="choice__input"
            />
            <span className="choice__face">
              {option.icon ? <span className="choice__icon">{option.icon}</span> : null}
              <span className="choice__text">{option.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface Swatch {
  value: string;
  name: string;
}

export function ColorField({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  swatches: Swatch[];
}) {
  const name = useId();
  const customId = useId();
  const isCustom = !swatches.some((swatch) => swatch.value === value.toLowerCase());
  return (
    <fieldset className="color-field">
      <legend className="field__label">{label}</legend>
      <div className="color-field__swatches">
        {swatches.map((swatch) => (
          <label key={swatch.value} className="swatch" title={swatch.name}>
            <input
              type="radio"
              name={name}
              className="swatch__input"
              checked={swatch.value === value.toLowerCase()}
              onChange={() => onChange(swatch.value)}
            />
            <span
              className="swatch__chip"
              style={{ background: swatch.value }}
              aria-hidden="true"
            />
            <span className="visually-hidden">{swatch.name}</span>
          </label>
        ))}
        <label
          className={`swatch swatch--custom${isCustom ? ' swatch--active' : ''}`}
          htmlFor={customId}
        >
          <input
            id={customId}
            type="color"
            className="swatch__color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <span className="swatch__custom-label">
            Custom<span className="visually-hidden"> colour, currently {value}</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange(value: T): void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input select"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ShapeIcon({ path, fillRule }: { path: string; fillRule?: 'nonzero' | 'evenodd' }) {
  if (!path) {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path
          d="M22 22 L78 78 M78 22 L22 78"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="-4 -4 108 108" aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" fillRule={fillRule} />
    </svg>
  );
}
