import { groundDistanceKm } from '../domain/coordinates';
import { THEME_PRESETS, TEXT_LIMITS, ZOOM_RANGE, type ThemePreset } from '../domain/defaults';
import type { PosterLayout } from '../domain/layout';
import { PAPER_SIZES } from '../domain/paper';
import { FRAME_SHAPES, getShape, MARKER_SHAPES } from '../domain/shapes';
import { markerPaths } from '../domain/sketch';
import { BODY_FONTS, TITLE_FONTS } from '../domain/typography';
import type { PosterConfig } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
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

const MARKER_SWATCHES: NamedSwatch[] = [
  { value: '#d7263d', name: 'color.red' },
  { value: '#e8698a', name: 'color.rose' },
  { value: '#c9a227', name: 'color.gold' },
  { value: '#1f4e79', name: 'color.navy' },
  { value: '#111111', name: 'color.black' },
  { value: '#ffffff', name: 'color.white' },
];

const PAPER_SWATCHES: NamedSwatch[] = [
  { value: '#fdfcf9', name: 'color.warmWhite' },
  { value: '#ffffff', name: 'color.pureWhite' },
  { value: '#f5efe4', name: 'color.linen' },
  { value: '#e9eef0', name: 'color.fog' },
  { value: '#151515', name: 'color.charcoal' },
];

const INK_SWATCHES: NamedSwatch[] = [
  { value: '#111111', name: 'color.black' },
  { value: '#1b1b1b', name: 'color.charcoal' },
  { value: '#3a3a3a', name: 'color.graphite' },
  { value: '#3b2f28', name: 'color.sepia' },
  { value: '#1f3a5f', name: 'color.inkBlue' },
  { value: '#f3f0ea', name: 'color.offWhite' },
];

const WATER_SWATCHES: NamedSwatch[] = [
  { value: '#a6cde6', name: 'color.lightBlue' },
  { value: '#cfe6f3', name: 'color.paleBlue' },
  { value: '#7fb2d4', name: 'color.riverBlue' },
  { value: '#9fd3cf', name: 'color.lagoon' },
  { value: '#3d6580', name: 'color.deepBlue' },
];

const SUBWAY_SWATCHES: NamedSwatch[] = [
  { value: '#2f5fa7', name: 'color.subwayBlue' },
  { value: '#e07b28', name: 'color.orange' },
  { value: '#3c8d5a', name: 'color.green' },
  { value: '#d7263d', name: 'color.red' },
  { value: '#8a8a8a', name: 'color.grey' },
  { value: '#111111', name: 'color.black' },
];

const OUTLINE_SWATCHES: NamedSwatch[] = [
  { value: '#ffffff', name: 'color.white' },
  { value: '#111111', name: 'color.black' },
];

/** A swatch whose name is translated when shown. */
type NamedSwatch = Omit<Swatch, 'name'> & { name: MessageKey };

function useSwatches() {
  const { t } = useI18n();
  return (list: NamedSwatch[]): Swatch[] =>
    list.map((swatch) => ({ ...swatch, name: t(swatch.name) }));
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function ShapeSection({ config, update, layout }: SectionProps & { layout: PosterLayout }) {
  const { t } = useI18n();
  const across = config.location
    ? groundDistanceKm(layout.frameExtent, config.zoom, config.location.latitude)
    : null;

  return (
    <Section title={t('shape.title')} description={t('shape.description')}>
      <Segmented
        legend={t('shape.legend')}
        variant="tiles"
        value={config.frameShape}
        onChange={(frameShape) => update({ frameShape })}
        options={FRAME_SHAPES.map((id) => ({
          value: id,
          label: t(`shapeName.${id}`),
          icon: <ShapeIcon path={getShape(id).path} />,
        }))}
      />
      <RangeField
        label={t('shape.zoom')}
        min={ZOOM_RANGE.min}
        max={ZOOM_RANGE.max}
        step={0.1}
        value={config.zoom}
        onChange={(zoom) => update({ zoom })}
        format={(zoom) =>
          across === null
            ? zoom.toFixed(1)
            : `${zoom.toFixed(1)} · ${t('shape.across', { km: across < 10 ? across.toFixed(1) : Math.round(across) })}`
        }
      />
      <p className="field__hint">{t('shape.zoomTip')}</p>
      <RangeField
        label={t('shape.size')}
        min={0.4}
        max={1}
        step={0.01}
        value={config.frameSize}
        onChange={(frameSize) => update({ frameSize })}
        format={pct}
      />
      <Segmented
        legend={t('shape.outside')}
        value={config.outside}
        onChange={(outside) => update({ outside })}
        options={[
          { value: 'hidden', label: t('outside.hidden') },
          { value: 'faded', label: t('outside.faded') },
          { value: 'visible', label: t('outside.visible') },
        ]}
      />
      {config.outside === 'faded' ? (
        <RangeField
          label={t('shape.fade')}
          min={0.1}
          max={0.95}
          step={0.05}
          value={config.outsideFade}
          onChange={(outsideFade) => update({ outsideFade })}
          format={pct}
        />
      ) : null}
      <Toggle
        label={t('shape.outline')}
        checked={config.frameOutline}
        onChange={(frameOutline) => update({ frameOutline })}
      />
      {config.frameOutline ? (
        <RangeField
          label={t('shape.outlineWidth')}
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
  const { t } = useI18n();
  const named = useSwatches();
  const hasMarker = config.markerShape !== 'none';
  return (
    <Section title={t('marker.title')} description={t('marker.description')} defaultOpen={false}>
      <Segmented
        legend={t('marker.symbol')}
        variant="tiles"
        value={config.markerShape}
        onChange={(markerShape) => update({ markerShape })}
        options={MARKER_SHAPES.map((id) => ({
          value: id,
          label: t(`shapeName.${id}`),
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
            legend={t('marker.look')}
            value={config.markerStyle}
            onChange={(markerStyle) => update({ markerStyle })}
            options={[
              { value: 'brush-fill', label: t('look.brush-fill') },
              { value: 'brush', label: t('look.brush') },
              { value: 'drawn', label: t('look.drawn') },
              { value: 'sketch', label: t('look.sketch') },
              { value: 'clean', label: t('look.clean') },
            ]}
          />
          <ColorField
            label={t('marker.color')}
            value={config.markerColor}
            onChange={(markerColor) => update({ markerColor })}
            swatches={named(MARKER_SWATCHES)}
          />
          <RangeField
            label={t('marker.size')}
            min={16}
            max={160}
            step={1}
            value={config.markerSize}
            onChange={(markerSize) => update({ markerSize })}
          />
          <RangeField
            label={t('marker.opacity')}
            min={0.1}
            max={1}
            step={0.05}
            value={config.markerOpacity}
            onChange={(markerOpacity) => update({ markerOpacity })}
            format={pct}
          />
          <Toggle
            label={t('marker.outline')}
            checked={config.markerOutline}
            onChange={(markerOutline) => update({ markerOutline })}
          />
          {config.markerOutline ? (
            <>
              <RangeField
                label={t('marker.outlineWidth')}
                min={1}
                max={12}
                step={0.5}
                value={config.markerOutlineWidth}
                onChange={(markerOutlineWidth) => update({ markerOutlineWidth })}
              />
              <ColorField
                label={t('marker.outlineColor')}
                value={config.markerOutlineColor}
                onChange={(markerOutlineColor) => update({ markerOutlineColor })}
                swatches={named(OUTLINE_SWATCHES)}
              />
            </>
          ) : null}
          <Toggle
            label={t('marker.shadow')}
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
  const { t } = useI18n();
  return (
    <Section title={t('text.title')} description={t('text.description')}>
      <TextField
        label={t('text.mainPhrase')}
        value={config.title}
        maxLength={TEXT_LIMITS.title}
        placeholder={t('defaults.title')}
        onChange={(title) => update({ title })}
      />
      <TextField
        label={t('text.names')}
        value={config.names}
        maxLength={TEXT_LIMITS.names}
        placeholder="Anita & Matthias"
        onChange={(names) => update({ names })}
      />
      <TextField
        label={t('text.placeLabel')}
        value={config.locationLabel}
        maxLength={TEXT_LIMITS.locationLabel}
        placeholder={config.location ? t('text.placePlaceholder') : t('text.placePlaceholderEmpty')}
        onChange={onLabelChange}
        hint={
          config.locationLabelCustom && config.location ? (
            <button type="button" className="link-button" onClick={onUseAutomaticLabel}>
              {t('text.useAutomatic')}
            </button>
          ) : (
            t('text.autoHint')
          )
        }
      />
      <Toggle
        label={t('text.showCoordinates')}
        checked={config.showCoordinates}
        onChange={(showCoordinates) => update({ showCoordinates })}
      />
      {config.showCoordinates ? (
        <div className="field-grid">
          <SelectField
            label={t('text.coordFormat')}
            value={config.coordinateFormat}
            onChange={(coordinateFormat) => update({ coordinateFormat })}
            options={[
              { value: 'decimal', label: t('text.decimal') },
              { value: 'dms', label: t('text.dms') },
            ]}
          />
          {config.coordinateFormat === 'decimal' ? (
            <SelectField
              label={t('text.decimals')}
              value={String(config.coordinatePrecision)}
              onChange={(value) => update({ coordinatePrecision: Number(value) })}
              options={['2', '3', '4', '5', '6'].map((value) => ({ value, label: value }))}
            />
          ) : null}
        </div>
      ) : null}
      <SelectField
        label={t('text.titleFont')}
        value={config.titleFont}
        onChange={(titleFont) => update({ titleFont })}
        options={TITLE_FONTS.map((font) => ({ value: font.id, label: t(`titleFont.${font.id}`) }))}
      />
      <SelectField
        label={t('text.bodyFont')}
        value={config.bodyFont}
        onChange={(bodyFont) => update({ bodyFont })}
        options={BODY_FONTS.map((font) => ({ value: font.id, label: t(`bodyFont.${font.id}`) }))}
      />
      <RangeField
        label={t('text.titleSize')}
        min={0.5}
        max={1.6}
        step={0.05}
        value={config.titleScale}
        onChange={(titleScale) => update({ titleScale })}
        format={pct}
      />
      <Segmented
        legend={t('text.alignment')}
        value={config.textAlignment}
        onChange={(textAlignment) => update({ textAlignment })}
        options={[
          { value: 'left', label: t('align.left') },
          { value: 'center', label: t('align.center') },
          { value: 'right', label: t('align.right') },
        ]}
      />
      <Toggle
        label={t('text.attribution')}
        checked={config.showAttribution}
        onChange={(showAttribution) => update({ showAttribution })}
        description={t('text.attributionHint')}
      />
    </Section>
  );
}

export function AppearanceSection({
  config,
  update,
  onPreset,
}: SectionProps & { onPreset(preset: ThemePreset): void }) {
  const { t } = useI18n();
  const named = useSwatches();
  return (
    <Section
      title={t('appearance.title')}
      description={t('appearance.description')}
      defaultOpen={false}
    >
      <fieldset className="presets">
        <legend className="field__label">{t('appearance.presets')}</legend>
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
              {t(`preset.${preset.id}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <ColorField
        label={t('appearance.background')}
        value={config.posterBackground}
        onChange={(posterBackground) => update({ posterBackground })}
        swatches={named(PAPER_SWATCHES)}
      />
      <ColorField
        label={t('appearance.mapLines')}
        value={config.mapInk}
        onChange={(mapInk) => update({ mapInk })}
        swatches={named(INK_SWATCHES)}
      />
      <ColorField
        label={t('appearance.textColor')}
        value={config.textColor}
        onChange={(textColor) => update({ textColor })}
        swatches={named(INK_SWATCHES)}
      />
      <Segmented
        legend={t('appearance.water')}
        value={config.waterStyle}
        onChange={(waterStyle) => update({ waterStyle })}
        options={[
          { value: 'color', label: t('water.color') },
          { value: 'ink', label: t('water.ink') },
          { value: 'tint', label: t('water.tint') },
          { value: 'outline', label: t('water.outline') },
        ]}
      />
      {config.waterStyle === 'color' ? (
        <ColorField
          label={t('appearance.waterColor')}
          value={config.waterColor}
          onChange={(waterColor) => update({ waterColor })}
          swatches={named(WATER_SWATCHES)}
        />
      ) : null}
      <RangeField
        label={t('appearance.contrast')}
        min={0}
        max={1}
        step={0.05}
        value={config.mapContrast}
        onChange={(mapContrast) => update({ mapContrast })}
        format={pct}
      />
      <RangeField
        label={t('appearance.lineWeight')}
        min={0.4}
        max={2.5}
        step={0.05}
        value={config.lineWeight}
        onChange={(lineWeight) => update({ lineWeight })}
        format={pct}
      />
      <Toggle
        label={t('appearance.buildings')}
        checked={config.showBuildings}
        onChange={(showBuildings) => update({ showBuildings })}
      />
      <Toggle
        label={t('appearance.subway')}
        checked={config.showSubway}
        onChange={(showSubway) => update({ showSubway })}
        description={t('appearance.subwayHint')}
      />
      {config.showSubway ? (
        <>
          <ColorField
            label={t('appearance.subwayColor')}
            value={config.subwayColor}
            onChange={(subwayColor) => update({ subwayColor })}
            swatches={named(SUBWAY_SWATCHES)}
          />
          <RangeField
            label={t('appearance.subwayFade')}
            min={0}
            max={0.9}
            step={0.05}
            value={config.subwayFade}
            onChange={(subwayFade) => update({ subwayFade })}
            format={pct}
          />
        </>
      ) : null}
      <div className="field-grid">
        <SelectField
          label={t('appearance.paper')}
          value={config.paperSize}
          onChange={(paperSize) => update({ paperSize })}
          options={PAPER_SIZES.map((paper) => ({ value: paper.id, label: t(`paper.${paper.id}`) }))}
        />
        <SelectField
          label={t('appearance.orientation')}
          value={config.orientation}
          onChange={(orientation) => update({ orientation })}
          options={[
            { value: 'portrait', label: t('orientation.portrait') },
            { value: 'landscape', label: t('orientation.landscape') },
          ]}
        />
      </div>
      <Segmented
        legend={t('appearance.frame')}
        value={config.previewFrame}
        onChange={(previewFrame) => update({ previewFrame })}
        options={[
          { value: 'none', label: t('frame.none') },
          { value: 'black', label: t('frame.black') },
          { value: 'white', label: t('frame.white') },
          { value: 'oak', label: t('frame.oak') },
        ]}
      />
    </Section>
  );
}
