import type { ReactNode } from 'react';
import { formatLocationLine } from '../domain/coordinates';
import { mixColors } from '../domain/colors';
import { shapeTransformAttribute, type PosterLayout } from '../domain/layout';
import { MAP_ATTRIBUTION_TEXT } from '../domain/mapStyle';
import { fitFontSize } from '../domain/measure';
import { getShape } from '../domain/shapes';
import type { FontFace } from '../domain/typography';
import { DETAIL_FONT, fontStack, getTitleFont, NAMES_FONT } from '../domain/typography';
import type { PosterConfig } from '../domain/types';

const OUTSIDE_OPACITY = { hidden: 1, faded: 0.8, visible: 0 } as const;

interface PosterOverlayProps {
  config: PosterConfig;
  layout: PosterLayout;
  /** Unique prefix for SVG ids (masks, filters) so several posters can share a page. */
  idPrefix: string;
  /** Preview mode adds the empty-state hint; export mode never does. */
  mode: 'preview' | 'export';
  /** Extra content placed first inside the root <svg> (e.g. embedded fonts on export). */
  defs?: string;
  /** Rendered below the overlay inside the root <svg> (e.g. the map image on SVG export). */
  underlay?: ReactNode;
  className?: string;
  /** Rendered size of the root <svg>; defaults to the design size. */
  width?: number | string;
  height?: number | string;
}

function PosterText({
  text,
  face,
  size,
  letterSpacing,
  y,
  layout,
  color,
  opacity = 1,
}: {
  text: string;
  face: FontFace;
  size: number;
  letterSpacing: number;
  y: number;
  layout: PosterLayout;
  color: string;
  opacity?: number;
}) {
  if (!text.trim()) return null;
  const fitted = fitFontSize(text, face, size, layout.text.maxWidth, letterSpacing);
  return (
    <text
      x={layout.text.x}
      y={y}
      textAnchor={layout.text.anchor}
      fontFamily={fontStack(face)}
      fontSize={fitted}
      fontWeight={face.weight}
      fontStyle={face.style}
      letterSpacing={letterSpacing || undefined}
      fill={color}
      fillOpacity={opacity}
      style={{ whiteSpace: 'pre' }}
    >
      {text}
    </text>
  );
}

/**
 * Everything on the poster except the map pixels: the keyhole mask, outline, marker and
 * typography. It is a pure SVG so that the export can render the exact same markup.
 */
export function PosterOverlay({
  config,
  layout,
  idPrefix,
  mode,
  defs,
  underlay,
  className,
  width,
  height,
}: PosterOverlayProps) {
  const frame = getShape(config.frameShape);
  const marker = getShape(config.markerShape);
  const { mapArea } = layout;
  const hasLocation = config.location !== null;
  const titleFont = getTitleFont(config.titleFont);
  const maskId = `${idPrefix}-outside`;
  const shadowId = `${idPrefix}-shadow`;
  const frameTransform = shapeTransformAttribute(layout.frame);
  const placeholderTint = mixColors(config.textColor, config.posterBackground, 0.93);

  const locationLine = formatLocationLine(
    config.locationLabel || (hasLocation ? '' : 'Your place'),
    config.location,
    {
      showCoordinates: config.showCoordinates,
      format: config.coordinateFormat,
      precision: config.coordinatePrecision,
    },
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={width ?? layout.width}
      height={height ?? layout.height}
      className={className}
      aria-hidden="true"
    >
      {defs ? <g dangerouslySetInnerHTML={{ __html: defs }} /> : null}
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={mapArea.x - 4}
          y={mapArea.y - 4}
          width={mapArea.width + 8}
          height={mapArea.height + 8}
        >
          <rect
            x={mapArea.x - 4}
            y={mapArea.y - 4}
            width={mapArea.width + 8}
            height={mapArea.height + 8}
            fill="#fff"
          />
          <path d={frame.path} transform={frameTransform} fill="#000" />
        </mask>
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {underlay}

      {hasLocation ? (
        <rect
          x={mapArea.x - 2}
          y={mapArea.y - 2}
          width={mapArea.width + 4}
          height={mapArea.height + 4}
          fill={config.posterBackground}
          fillOpacity={OUTSIDE_OPACITY[config.outside]}
          mask={`url(#${maskId})`}
        />
      ) : (
        <g>
          <path d={frame.path} transform={frameTransform} fill={placeholderTint} />
          {mode === 'preview' ? (
            <text
              x={layout.anchor.x}
              y={layout.anchor.y + 120}
              textAnchor="middle"
              fontFamily={fontStack(DETAIL_FONT)}
              fontSize={26}
              letterSpacing={1}
              fill={config.textColor}
              fillOpacity={0.6}
            >
              Search for a place to begin
            </text>
          ) : null}
        </g>
      )}

      {config.frameOutline ? (
        <path
          d={frame.path}
          transform={frameTransform}
          fill="none"
          stroke={config.mapInk}
          strokeWidth={config.frameOutlineWidth / layout.frame.scale}
          strokeLinejoin="round"
        />
      ) : null}

      {layout.marker && marker.path ? (
        <g filter={config.markerShadow ? `url(#${shadowId})` : undefined}>
          <path
            d={marker.path}
            transform={shapeTransformAttribute(layout.marker)}
            fill={config.markerColor}
            fillOpacity={config.markerOpacity}
            fillRule={marker.fillRule}
            stroke={config.markerOutline ? config.markerOutlineColor : undefined}
            strokeWidth={
              config.markerOutline
                ? (config.markerOutlineWidth * 2) / layout.marker.scale
                : undefined
            }
            strokeLinejoin="round"
            paintOrder="stroke"
          />
        </g>
      ) : null}

      <PosterText
        text={config.title}
        face={titleFont}
        size={layout.sizes.title * titleFont.sizeFactor}
        letterSpacing={titleFont.letterSpacing}
        y={layout.text.titleY}
        layout={layout}
        color={config.textColor}
      />
      <PosterText
        text={config.names}
        face={NAMES_FONT}
        size={layout.sizes.names}
        letterSpacing={0.6}
        y={layout.text.namesY}
        layout={layout}
        color={config.textColor}
      />
      <PosterText
        text={locationLine}
        face={DETAIL_FONT}
        size={layout.sizes.location}
        letterSpacing={1.1}
        y={layout.text.locationY}
        layout={layout}
        color={config.textColor}
        opacity={0.85}
      />
      {config.showAttribution ? (
        <text
          x={layout.width - 72}
          y={layout.text.attributionY}
          textAnchor="end"
          fontFamily={fontStack(DETAIL_FONT)}
          fontSize={layout.sizes.attribution}
          fontWeight={DETAIL_FONT.weight}
          letterSpacing={0.4}
          fill={config.textColor}
          fillOpacity={0.5}
        >
          {MAP_ATTRIBUTION_TEXT}
        </text>
      ) : null}
    </svg>
  );
}
