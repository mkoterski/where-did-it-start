import { groundDistanceKm } from '../domain/coordinates';
import { THEME_PRESETS, TEXT_LIMITS, ZOOM_RANGE, type ThemePreset } from '../domain/defaults';
import type { PosterLayout } from '../domain/layout';
import { PAPER_SIZES } from '../domain/paper';
import { FRAME_SHAPES, getShape, MARKER_SHAPES } from '../domain/shapes';
import { markerPaths } from '../domain/sketch';
import { BODY_FONTS, TITLE_FONTS } from '../domain/typography';
import type { PosterConfig } from '../domain/types';
import {
  ColorField,
  RangeField,
  Section,
  Segmented,
  SelectField,
  ShapeIcon,
  TextField,
  Toggle,
  type Swatch,
} from './controls';

interface SectionProps {
  config: PosterConfig;
  update(patch: Partial<PosterConfig>): void;
}

const MARKER_SWATCHES: Swatch[] = [
  { value: '#d7263d', name: 'Red' },
  { value: '#e8698a', name: 'Rose' },
  { value: '#c9a227', name: 'Gold' },
  { value: '#1f4e79', name: 'Navy' },
  { value: '#111111', name: 'Black' },
  { value: '#ffffff', name: 'White' },
];

const PAPER_SWATCHES: Swatch[] = [
  { value: '#fdfcf9', name: 'Warm white' },
  { value: '#ffffff', name: 'Pure white' },
  { value: '#f5efe4', name: 'Linen' },
  { value: '#e9eef0', name: 'Fog' },
  { value: '#151515', name: 'Charcoal' },
];

const INK_SWATCHES: Swatch[] = [
  { value: '#111111', name: 'Black' },
  { value: '#1b1b1b', name: 'Charcoal' },
  { value: '#3a3a3a', name: 'Graphite' },
  { value: '#3b2f28', name: 'Sepia' },
  { value: '#1f3a5f', name: 'Ink blue' },
  { value: '#f3f0ea', name: 'Off-white' },
];

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function ShapeSection({ config, update, layout }: SectionProps & { layout: PosterLayout }) {
  const across = config.location
    ? groundDistanceKm(layout.frameExtent, config.zoom, config.location.latitude)
    : null;

  return (
    <Section title="2 · Shape" description="The keyhole that reveals your map">
      <Segmented
        legend="Shape"
        variant="tiles"
        value={config.frameShape}
        onChange={(frameShape) => update({ frameShape })}
        options={FRAME_SHAPES.map((id) => ({
          value: id,
          label: getShape(id).label,
          icon: <ShapeIcon path={getShape(id).path} />,
        }))}
      />
      <RangeField
        label="Map zoom"
        min={ZOOM_RANGE.min}
        max={ZOOM_RANGE.max}
        step={0.1}
        value={config.zoom}
        onChange={(zoom) => update({ zoom })}
        format={(zoom) =>
          across === null
            ? zoom.toFixed(1)
            : `${zoom.toFixed(1)} · ≈ ${across < 10 ? across.toFixed(1) : Math.round(across)} km across`
        }
      />
      <p className="field__hint">Tip: zooming the map above changes the poster zoom too.</p>
      <RangeField
        label="Shape size"
        min={0.4}
        max={1}
        step={0.01}
        value={config.frameSize}
        onChange={(frameSize) => update({ frameSize })}
        format={pct}
      />
      <Segmented
        legend="Map outside the shape"
        value={config.outside}
        onChange={(outside) => update({ outside })}
        options={[
          { value: 'hidden', label: 'Hidden' },
          { value: 'faded', label: 'Faded' },
          { value: 'visible', label: 'Visible' },
        ]}
      />
      <Toggle
        label="Outline the shape"
        checked={config.frameOutline}
        onChange={(frameOutline) => update({ frameOutline })}
      />
      {config.frameOutline ? (
        <RangeField
          label="Shape outline width"
          min={0.5}
          max={12}
          step={0.5}
          value={config.frameOutlineWidth}
          onChange={(frameOutlineWidth) => update({ frameOutlineWidth })}
        />
      ) : null}
    </Section>
  );
}

export function MarkerSection({ config, update }: SectionProps) {
  const hasMarker = config.markerShape !== 'none';
  return (
    <Section title="3 · Marker" description="The symbol on your exact spot" defaultOpen={false}>
      <Segmented
        legend="Marker symbol"
        variant="tiles"
        value={config.markerShape}
        onChange={(markerShape) => update({ markerShape })}
        options={MARKER_SHAPES.map((id) => ({
          value: id,
          label: getShape(id).label,
          icon: (
            <ShapeIcon
              path={getShape(id).path}
              fillRule={getShape(id).fillRule}
              paths={
                id === 'none' ? undefined : markerPaths(id, config.markerStyle, 'currentColor')
              }
            />
          ),
        }))}
      />
      {hasMarker ? (
        <>
          <Segmented
            legend="Marker look"
            value={config.markerStyle}
            onChange={(markerStyle) => update({ markerStyle })}
            options={[
              { value: 'drawn', label: 'Hand-drawn' },
              { value: 'sketch', label: 'Pencil sketch' },
              { value: 'clean', label: 'Clean' },
            ]}
          />
          <ColorField
            label="Marker colour"
            value={config.markerColor}
            onChange={(markerColor) => update({ markerColor })}
            swatches={MARKER_SWATCHES}
          />
          <RangeField
            label="Marker size"
            min={16}
            max={160}
            step={1}
            value={config.markerSize}
            onChange={(markerSize) => update({ markerSize })}
          />
          <RangeField
            label="Marker opacity"
            min={0.1}
            max={1}
            step={0.05}
            value={config.markerOpacity}
            onChange={(markerOpacity) => update({ markerOpacity })}
            format={pct}
          />
          <Toggle
            label="Outline the marker"
            checked={config.markerOutline}
            onChange={(markerOutline) => update({ markerOutline })}
          />
          {config.markerOutline ? (
            <>
              <RangeField
                label="Marker outline width"
                min={1}
                max={12}
                step={0.5}
                value={config.markerOutlineWidth}
                onChange={(markerOutlineWidth) => update({ markerOutlineWidth })}
              />
              <ColorField
                label="Outline colour"
                value={config.markerOutlineColor}
                onChange={(markerOutlineColor) => update({ markerOutlineColor })}
                swatches={[
                  { value: '#ffffff', name: 'White' },
                  { value: '#111111', name: 'Black' },
                ]}
              />
            </>
          ) : null}
          <Toggle
            label="Soft shadow under the marker"
            checked={config.markerShadow}
            onChange={(markerShadow) => update({ markerShadow })}
          />
        </>
      ) : null}
    </Section>
  );
}

export function TextSection({
  config,
  update,
  onLabelChange,
  onUseAutomaticLabel,
}: SectionProps & { onLabelChange(value: string): void; onUseAutomaticLabel(): void }) {
  return (
    <Section title="4 · Text" description="Title, names and place">
      <TextField
        label="Main phrase"
        value={config.title}
        maxLength={TEXT_LIMITS.title}
        placeholder="Where it all began..."
        onChange={(title) => update({ title })}
      />
      <TextField
        label="Names"
        value={config.names}
        maxLength={TEXT_LIMITS.names}
        placeholder="Anita & Matthias"
        onChange={(names) => update({ names })}
      />
      <TextField
        label="Place label"
        value={config.locationLabel}
        maxLength={TEXT_LIMITS.locationLabel}
        placeholder={config.location ? 'e.g. Berlin' : 'Filled in when you choose a place'}
        onChange={onLabelChange}
        hint={
          config.locationLabelCustom && config.location ? (
            <button type="button" className="link-button" onClick={onUseAutomaticLabel}>
              Use the place name again
            </button>
          ) : (
            'Filled in automatically from the selected place. Edit it freely.'
          )
        }
      />
      <Toggle
        label="Show coordinates"
        checked={config.showCoordinates}
        onChange={(showCoordinates) => update({ showCoordinates })}
      />
      {config.showCoordinates ? (
        <div className="field-grid">
          <SelectField
            label="Coordinate format"
            value={config.coordinateFormat}
            onChange={(coordinateFormat) => update({ coordinateFormat })}
            options={[
              { value: 'decimal', label: 'Decimal · 48.15838°N' },
              { value: 'dms', label: 'Degrees · 48°09\'30.2"N' },
            ]}
          />
          {config.coordinateFormat === 'decimal' ? (
            <SelectField
              label="Decimals"
              value={String(config.coordinatePrecision)}
              onChange={(value) => update({ coordinatePrecision: Number(value) })}
              options={['2', '3', '4', '5', '6'].map((value) => ({ value, label: value }))}
            />
          ) : null}
        </div>
      ) : null}
      <SelectField
        label="Title font"
        value={config.titleFont}
        onChange={(titleFont) => update({ titleFont })}
        options={TITLE_FONTS.map((font) => ({ value: font.id, label: font.label }))}
      />
      <SelectField
        label="Text font (names and place)"
        value={config.bodyFont}
        onChange={(bodyFont) => update({ bodyFont })}
        options={BODY_FONTS.map((font) => ({ value: font.id, label: font.label }))}
      />
      <RangeField
        label="Title size"
        min={0.5}
        max={1.6}
        step={0.05}
        value={config.titleScale}
        onChange={(titleScale) => update({ titleScale })}
        format={pct}
      />
      <Segmented
        legend="Text alignment"
        value={config.textAlignment}
        onChange={(textAlignment) => update({ textAlignment })}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Centre' },
          { value: 'right', label: 'Right' },
        ]}
      />
      <Toggle
        label="Print map attribution"
        checked={config.showAttribution}
        onChange={(showAttribution) => update({ showAttribution })}
        description="OpenStreetMap data is free to use when credited. Keep this on if you share or sell the poster."
      />
    </Section>
  );
}

export function AppearanceSection({
  config,
  update,
  onPreset,
}: SectionProps & { onPreset(preset: ThemePreset): void }) {
  return (
    <Section title="5 · Appearance" description="Colours, map style and paper" defaultOpen={false}>
      <fieldset className="presets">
        <legend className="field__label">Colour presets</legend>
        <div className="presets__list">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="preset"
              onClick={() => onPreset(preset)}
              style={{ background: preset.posterBackground, color: preset.textColor }}
            >
              <span
                className="preset__ink"
                style={{ background: preset.mapInk }}
                aria-hidden="true"
              />
              <span
                className="preset__accent"
                style={{ background: preset.markerColor }}
                aria-hidden="true"
              />
              {preset.label}
            </button>
          ))}
        </div>
      </fieldset>
      <ColorField
        label="Poster background"
        value={config.posterBackground}
        onChange={(posterBackground) => update({ posterBackground })}
        swatches={PAPER_SWATCHES}
      />
      <ColorField
        label="Map lines"
        value={config.mapInk}
        onChange={(mapInk) => update({ mapInk })}
        swatches={INK_SWATCHES}
      />
      <ColorField
        label="Text colour"
        value={config.textColor}
        onChange={(textColor) => update({ textColor })}
        swatches={INK_SWATCHES}
      />
      <Segmented
        legend="Water"
        value={config.waterStyle}
        onChange={(waterStyle) => update({ waterStyle })}
        options={[
          { value: 'ink', label: 'Solid' },
          { value: 'tint', label: 'Tinted' },
          { value: 'outline', label: 'Outline' },
        ]}
      />
      <RangeField
        label="Street contrast"
        min={0}
        max={1}
        step={0.05}
        value={config.mapContrast}
        onChange={(mapContrast) => update({ mapContrast })}
        format={pct}
      />
      <RangeField
        label="Line weight"
        min={0.4}
        max={2.5}
        step={0.05}
        value={config.lineWeight}
        onChange={(lineWeight) => update({ lineWeight })}
        format={pct}
      />
      <Toggle
        label="Show buildings"
        checked={config.showBuildings}
        onChange={(showBuildings) => update({ showBuildings })}
      />
      <div className="field-grid">
        <SelectField
          label="Paper size"
          value={config.paperSize}
          onChange={(paperSize) => update({ paperSize })}
          options={PAPER_SIZES.map((paper) => ({ value: paper.id, label: paper.label }))}
        />
        <SelectField
          label="Orientation"
          value={config.orientation}
          onChange={(orientation) => update({ orientation })}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
        />
      </div>
      <Segmented
        legend="Frame in preview (not printed)"
        value={config.previewFrame}
        onChange={(previewFrame) => update({ previewFrame })}
        options={[
          { value: 'none', label: 'None' },
          { value: 'black', label: 'Black' },
          { value: 'white', label: 'White' },
          { value: 'oak', label: 'Oak' },
        ]}
      />
    </Section>
  );
}
