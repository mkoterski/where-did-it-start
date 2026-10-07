/** Shapes that can act as the "keyhole" which reveals the map. */
export type FrameShape = 'heart' | 'circle' | 'rounded-square' | 'diamond' | 'hexagon' | 'star';

/** Symbols that can mark the exact location inside the keyhole. */
export type MarkerShape = 'heart' | 'circle' | 'pin' | 'star' | 'diamond' | 'none';

export type ShapeId = FrameShape | MarkerShape;

/**
 * How the marker symbol is rendered: brush pen (filled or as a single outline stroke),
 * felt-tip pen, pencil sketch, or vector-clean.
 */
export type MarkerStyle = 'brush-fill' | 'brush' | 'drawn' | 'sketch' | 'clean';

export type OutsideMode = 'hidden' | 'faded' | 'visible';
export type CoordinateFormat = 'decimal' | 'dms';
export type TextAlignment = 'left' | 'center' | 'right';
export type TitleFont = 'sacramento' | 'great-vibes' | 'playfair' | 'jost';
/** Font for the names and the place/coordinates line. */
export type BodyFont = 'jost' | 'cormorant' | 'josefin' | 'courier';
export type WaterStyle = 'ink' | 'tint' | 'outline';
export type PaperSize = 'a4' | 'a3' | '30x40' | '50x70' | 'square';
export type Orientation = 'portrait' | 'landscape';
export type PreviewFrame = 'none' | 'black' | 'white' | 'oak';

export interface LocationSelection {
  latitude: number;
  longitude: number;
  /** Full, human readable description (e.g. the geocoder's display name). */
  displayName: string;
  /** Short name of the place itself, e.g. "Potsdamer Platz". */
  name?: string;
  city?: string;
  country?: string;
}

export interface PosterConfig {
  location: LocationSelection | null;
  /** Map zoom of the poster at design scale (1 design unit = 1 CSS pixel). */
  zoom: number;

  frameShape: FrameShape;
  /** Size of the keyhole relative to the map area (0.4 – 1). */
  frameSize: number;
  outside: OutsideMode;
  frameOutline: boolean;
  frameOutlineWidth: number;

  markerShape: MarkerShape;
  markerStyle: MarkerStyle;
  markerColor: string;
  markerOpacity: number;
  /** Marker size in design units. */
  markerSize: number;
  markerOutline: boolean;
  markerOutlineWidth: number;
  markerOutlineColor: string;
  markerShadow: boolean;

  title: string;
  names: string;
  locationLabel: string;
  /** True once the user typed their own label; stops auto-updates from the geocoder. */
  locationLabelCustom: boolean;
  showCoordinates: boolean;
  coordinateFormat: CoordinateFormat;
  coordinatePrecision: number;
  showAttribution: boolean;
  titleFont: TitleFont;
  bodyFont: BodyFont;
  titleScale: number;
  textAlignment: TextAlignment;

  posterBackground: string;
  textColor: string;
  mapInk: string;
  waterStyle: WaterStyle;
  showBuildings: boolean;
  lineWeight: number;
  /** 0 – 1. Strength of minor streets relative to major roads. */
  mapContrast: number;

  paperSize: PaperSize;
  orientation: Orientation;
  previewFrame: PreviewFrame;
}
