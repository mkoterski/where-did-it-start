import { paperDimensionsMm } from './paper';
import { getShape, markerAnchor } from './shapes';
import type { PosterConfig, TextAlignment } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** translate(x, y) scale(scale) applied to a shape drawn in its 100 × 100 box. */
export interface ShapeTransform {
  x: number;
  y: number;
  scale: number;
}

export interface TextLayout {
  x: number;
  anchor: 'start' | 'middle' | 'end';
  maxWidth: number;
  titleY: number;
  namesY: number;
  locationY: number;
  attributionY: number;
}

/**
 * Poster geometry in "design units". The shorter paper side is always 1000 units, and one
 * design unit equals one CSS pixel of the map at `config.zoom`. Preview and export both
 * render this layout, just at different scales.
 */
export interface PosterLayout {
  width: number;
  height: number;
  /** The visible map window. */
  mapArea: Rect;
  /** The rendered map, centred on the anchor so that map centre = selected location. */
  mapView: Rect;
  /** Where the selected location sits on the poster. */
  anchor: { x: number; y: number };
  frame: ShapeTransform;
  /** Largest side of the keyhole shape in design units. */
  frameExtent: number;
  marker: ShapeTransform | null;
  text: TextLayout;
  sizes: { title: number; names: number; location: number; attribution: number };
}

export const MARGIN = 72;
const TEXT_BLOCK = 340;
const SIDE_GAP = 56;

export function posterDimensions(config: Pick<PosterConfig, 'paperSize' | 'orientation'>): {
  width: number;
  height: number;
} {
  const { widthMm, heightMm } = paperDimensionsMm(config.paperSize, config.orientation);
  const short = Math.min(widthMm, heightMm);
  return {
    width: Math.round((widthMm / short) * 1000 * 10) / 10,
    height: Math.round((heightMm / short) * 1000 * 10) / 10,
  };
}

function alignedX(alignment: TextAlignment, left: number, right: number) {
  if (alignment === 'left') return { x: left, anchor: 'start' as const };
  if (alignment === 'right') return { x: right, anchor: 'end' as const };
  return { x: (left + right) / 2, anchor: 'middle' as const };
}

export function computeLayout(config: PosterConfig): PosterLayout {
  const { width, height } = posterDimensions(config);
  const sideBySide = width / height > 1.15;

  let mapArea: Rect;
  let text: TextLayout;

  if (sideBySide) {
    const side = height - 2 * MARGIN;
    mapArea = { x: MARGIN, y: MARGIN, width: side, height: side };
    const left = MARGIN + side + SIDE_GAP;
    const right = width - MARGIN;
    const { x, anchor } = alignedX(config.textAlignment, left, right);
    const titleY = height / 2 - 6;
    text = {
      x,
      anchor,
      maxWidth: right - left,
      titleY,
      namesY: titleY + 72,
      locationY: titleY + 114,
      attributionY: height - 36,
    };
  } else {
    mapArea = {
      x: MARGIN,
      y: MARGIN,
      width: width - 2 * MARGIN,
      height: height - 2 * MARGIN - TEXT_BLOCK,
    };
    const { x, anchor } = alignedX(config.textAlignment, MARGIN, width - MARGIN);
    const titleY = mapArea.y + mapArea.height + 168;
    text = {
      x,
      anchor,
      maxWidth: width - 2 * MARGIN,
      titleY,
      namesY: titleY + 72,
      locationY: titleY + 114,
      attributionY: height - 34,
    };
  }

  // Fit the keyhole's bounding box into the map area, then centre it there.
  const shape = getShape(config.frameShape);
  const scale =
    config.frameSize *
    Math.min(mapArea.width / shape.bbox.width, mapArea.height / shape.bbox.height);
  const frame: ShapeTransform = {
    x: mapArea.x + mapArea.width / 2 - (shape.bbox.x + shape.bbox.width / 2) * scale,
    y: mapArea.y + mapArea.height / 2 - (shape.bbox.y + shape.bbox.height / 2) * scale,
    scale,
  };
  const anchor = {
    x: frame.x + shape.anchor.x * scale,
    y: frame.y + shape.anchor.y * scale,
  };

  // The map must be centred on the anchor and still cover the whole map area.
  const halfWidth = Math.ceil(Math.max(anchor.x - mapArea.x, mapArea.x + mapArea.width - anchor.x));
  const halfHeight = Math.ceil(
    Math.max(anchor.y - mapArea.y, mapArea.y + mapArea.height - anchor.y),
  );
  const mapView: Rect = {
    x: anchor.x - halfWidth,
    y: anchor.y - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };

  let marker: ShapeTransform | null = null;
  if (config.markerShape !== 'none') {
    const markerScale = config.markerSize / 100;
    const point = markerAnchor(config.markerShape);
    marker = {
      x: anchor.x - point.x * markerScale,
      y: anchor.y - point.y * markerScale,
      scale: markerScale,
    };
  }

  return {
    width,
    height,
    mapArea,
    mapView,
    anchor,
    frame,
    frameExtent: Math.max(shape.bbox.width, shape.bbox.height) * scale,
    marker,
    text,
    sizes: { title: 88 * config.titleScale, names: 30, location: 19, attribution: 11 },
  };
}

export function shapeTransformAttribute(transform: ShapeTransform): string {
  return `translate(${transform.x} ${transform.y}) scale(${transform.scale})`;
}

/**
 * On-screen size (px) of the keyhole in the editor map. The editor runs
 * `log2(editorKeyholePixels / frameExtent)` zoom levels away from the poster so that the
 * keyhole always has a comfortable size, whatever the poster zoom.
 */
export function editorKeyholePixels(width: number, height: number): number {
  return Math.min(560, Math.max(120, Math.min(width, height) * 0.68));
}
