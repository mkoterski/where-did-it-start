import type { FrameShape, MarkerShape, ShapeId } from './types';

/**
 * Every shape is drawn in a 100 × 100 box. `anchor` is the point inside that box that sits
 * exactly on the selected location (the visual centre of a heart, the tip of a pin…), and
 * `bbox` is the tight bounding box of the drawn path, used for layout.
 *
 * To add a shape: add its id to `FrameShape` and/or `MarkerShape` in `types.ts`, add an entry
 * here and list it in `FRAME_SHAPES` / `MARKER_SHAPES`. Preview, editor keyhole and export
 * all read from this registry.
 */
export interface ShapeDefinition {
  id: ShapeId;
  path: string;
  anchor: { x: number; y: number };
  bbox: { x: number; y: number; width: number; height: number };
  fillRule?: 'nonzero' | 'evenodd';
}

function polygon(points: Array<[number, number]>): string {
  return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join(' L')} Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function regularPolygon(sides: number, radius: number, cx: number, cy: number, rotation = -90) {
  return Array.from({ length: sides }, (_, i): [number, number] => {
    const angle = ((rotation + (360 / sides) * i) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i): [number, number] => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((-90 + 36 * i) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
}

function boundsOf(points: Array<[number, number]>) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const HEART =
  'M50 95 C40 86 2 61 2 31 C2 15 14 5 28.5 5 C39 5 46.5 11.5 50 19.5 ' +
  'C53.5 11.5 61 5 71.5 5 C86 5 98 15 98 31 C98 61 60 86 50 95 Z';

const STAR_POINTS = starPoints(50, 54, 49, 20);
const HEXAGON_POINTS = regularPolygon(6, 49, 50, 50);

export const SHAPES: Record<ShapeId, ShapeDefinition> = {
  heart: {
    id: 'heart',
    path: HEART,
    anchor: { x: 50, y: 46 },
    bbox: { x: 2, y: 5, width: 96, height: 90 },
  },
  circle: {
    id: 'circle',
    path: 'M2 50 A48 48 0 1 0 98 50 A48 48 0 1 0 2 50 Z',
    anchor: { x: 50, y: 50 },
    bbox: { x: 2, y: 2, width: 96, height: 96 },
  },
  'rounded-square': {
    id: 'rounded-square',
    path:
      'M16 3 H84 A13 13 0 0 1 97 16 V84 A13 13 0 0 1 84 97 H16 ' +
      'A13 13 0 0 1 3 84 V16 A13 13 0 0 1 16 3 Z',
    anchor: { x: 50, y: 50 },
    bbox: { x: 3, y: 3, width: 94, height: 94 },
  },
  diamond: {
    id: 'diamond',
    path: 'M50 2 L98 50 L50 98 L2 50 Z',
    anchor: { x: 50, y: 50 },
    bbox: { x: 2, y: 2, width: 96, height: 96 },
  },
  hexagon: {
    id: 'hexagon',
    path: polygon(HEXAGON_POINTS),
    anchor: { x: 50, y: 50 },
    bbox: boundsOf(HEXAGON_POINTS),
  },
  star: {
    id: 'star',
    path: polygon(STAR_POINTS),
    anchor: { x: 50, y: 56 },
    bbox: boundsOf(STAR_POINTS),
  },
  pin: {
    id: 'pin',
    path:
      'M50 98 C46 90 17 61 17 35 A33 33 0 0 1 83 35 C83 61 54 90 50 98 Z ' +
      'M50 22 A13 13 0 1 0 50 48 A13 13 0 1 0 50 22 Z',
    anchor: { x: 50, y: 98 },
    bbox: { x: 17, y: 2, width: 66, height: 96 },
    fillRule: 'evenodd',
  },
  none: {
    id: 'none',
    path: '',
    anchor: { x: 50, y: 50 },
    bbox: { x: 0, y: 0, width: 100, height: 100 },
  },
};

export const FRAME_SHAPES: FrameShape[] = [
  'heart',
  'circle',
  'rounded-square',
  'diamond',
  'hexagon',
  'star',
];

export const MARKER_SHAPES: MarkerShape[] = ['heart', 'circle', 'pin', 'star', 'diamond', 'none'];

export function getShape(id: ShapeId): ShapeDefinition {
  return SHAPES[id];
}

/**
 * Marker anchors differ from frame anchors: a heart marker should sit centred on the spot,
 * while a pin marker stands on its tip.
 */
export function markerAnchor(id: MarkerShape): { x: number; y: number } {
  if (id === 'pin') return SHAPES.pin.anchor;
  const box = SHAPES[id].bbox;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
