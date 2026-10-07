import { maplibregl } from '../components/maplibre';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PosterOverlay } from '../components/PosterOverlay';
import { computeLayout, type PosterLayout } from '../domain/layout';
import { buildMapStyle, mapStyleOptions } from '../domain/mapStyle';
import { exportPixelSize, paperDimensionsMm, type ExportQuality } from '../domain/paper';
import type { PosterConfig } from '../domain/types';
import { loadPosterFonts } from '../domain/fontLoading';
import { exportFilename } from './filename';
import { embeddedFontCss } from './fonts';

export type ExportFormat = 'png' | 'pdf' | 'svg';

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  onProgress?: (message: string) => void;
  /** Rendering timeout for the map tiles. */
  timeoutMs?: number;
  /**
   * PDF and SVG only: draw the map, shapes and text as vectors straight from the map data
   * instead of rendering a print-size image. Lighter on the device and sharp at any size.
   */
  vector?: boolean;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  dpi: number;
  /** True when the file is fully vector (no embedded images). */
  vector?: boolean;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

/**
 * Renders the map off-screen at print resolution. The map is laid out at design size
 * (1 unit = 1 CSS px) and `pixelRatio` scales it up, so line widths and the visible area
 * match the preview exactly.
 */
async function renderMap(
  config: PosterConfig,
  layout: PosterLayout,
  scale: number,
  timeoutMs: number,
): Promise<HTMLCanvasElement> {
  const location = config.location;
  if (!location) throw new ExportError('Choose a location first.');

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${layout.mapView.width}px`,
    height: `${layout.mapView.height}px`,
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(container);

  let map: maplibregl.Map | undefined;
  try {
    try {
      map = new maplibregl.Map({
        container,
        style: buildMapStyle(mapStyleOptions(config, false)),
        center: [location.longitude, location.latitude],
        zoom: config.zoom,
        interactive: false,
        attributionControl: false,
        pixelRatio: scale,
        fadeDuration: 0,
        maxCanvasSize: [16384, 16384],
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
      });
    } catch {
      throw new ExportError(
        'Your browser could not create a map for the export (WebGL unavailable).',
      );
    }
    const instance = map;
    const errors: string[] = [];
    instance.on('error', (event) => errors.push(String(event.error?.message ?? 'unknown error')));

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new ExportError('The map took too long to load. Please try again.')),
        timeoutMs,
      );
      instance.once('idle', () => {
        window.clearTimeout(timer);
        resolve();
      });
    });

    if (errors.length > 0) {
      throw new ExportError(
        'Some map tiles could not be loaded, so the export would be incomplete. ' +
          'Check your connection and try again.',
      );
    }

    const source = instance.getCanvas();
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d');
    if (!ctx) throw new ExportError('Could not create a drawing surface for the export.');
    ctx.drawImage(source, 0, 0);
    return copy;
  } finally {
    map?.remove();
    container.remove();
  }
}

function overlayMarkup(
  config: PosterConfig,
  layout: PosterLayout,
  fontCss: string,
  size: { width: number | string; height: number | string },
  underlay?: ReactNode,
): string {
  return renderToStaticMarkup(
    <PosterOverlay
      config={config}
      layout={layout}
      idPrefix="export"
      mode="export"
      defs={`<style>${fontCss}</style>`}
      underlay={underlay}
      width={size.width}
      height={size.height}
    />,
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ExportError('The poster text could not be rendered.'));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new ExportError('The image was too large for this browser. Try Standard quality.'),
            ),
      type,
      quality,
    ),
  );
}

async function composeRaster(
  config: PosterConfig,
  layout: PosterLayout,
  mapCanvas: HTMLCanvasElement,
  fontCss: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const scale = width / layout.width;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx)
    throw new ExportError('The image was too large for this browser. Try Standard quality.');

  ctx.fillStyle = config.posterBackground;
  ctx.fillRect(0, 0, width, height);

  const { mapArea, mapView } = layout;
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapArea.x * scale, mapArea.y * scale, mapArea.width * scale, mapArea.height * scale);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    mapCanvas,
    mapView.x * scale,
    mapView.y * scale,
    mapView.width * scale,
    mapView.height * scale,
  );
  ctx.restore();

  const svg = overlayMarkup(config, layout, fontCss, { width, height });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = await loadImage(url);
    await image.decode?.().catch(() => undefined);
    ctx.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

/**
 * Fully vector SVG/PDF: map paths from the vector tiles, the shared overlay without masks or
 * filters, and text converted to outlines. Needs no WebGL and no large canvas.
 */
async function exportVector(
  config: PosterConfig,
  layout: PosterLayout,
  format: 'pdf' | 'svg',
  onProgress?: (message: string) => void,
): Promise<Blob> {
  const { widthMm, heightMm } = paperDimensionsMm(config.paperSize, config.orientation);
  const [{ renderVectorMap }, { outlineSvgText }] = await Promise.all([
    import('./vectorMap'),
    import('./outlineText'),
  ]);

  onProgress?.('Loading the map data…');
  let map: Awaited<ReturnType<typeof renderVectorMap>>;
  try {
    map = await renderVectorMap(config, layout, { idPrefix: 'vmap' });
  } catch {
    throw new ExportError(
      'The map data could not be loaded, so the export would be incomplete. ' +
        'Check your connection and try again.',
    );
  }

  onProgress?.('Drawing the poster as vectors…');
  const underlay = (
    <>
      <rect width={layout.width} height={layout.height} fill={config.posterBackground} />
      <g dangerouslySetInnerHTML={{ __html: `<defs>${map.defs}</defs>${map.body}` }} />
    </>
  );
  const markup = renderToStaticMarkup(
    <PosterOverlay
      config={config}
      layout={layout}
      idPrefix="export"
      mode="export"
      underlay={underlay}
      width={`${widthMm}mm`}
      height={`${heightMm}mm`}
      maskFree
    />,
  );

  onProgress?.('Converting the text to outlines…');
  let svg: string;
  try {
    svg = await outlineSvgText(markup);
  } catch {
    throw new ExportError('The poster fonts could not be loaded. Please try again.');
  }

  if (format === 'svg') {
    return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: 'image/svg+xml' });
  }

  onProgress?.('Creating the PDF…');
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const pdf = new jsPDF({
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });
  // svg2pdf reads computed styles, so the SVG has to be in the document while it converts.
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', opacity: '0' });
  host.innerHTML = svg;
  document.body.appendChild(host);
  try {
    const element = host.querySelector('svg');
    if (!element) throw new ExportError('The poster could not be prepared for the PDF.');
    await svg2pdf(element, pdf, { x: 0, y: 0, width: widthMm, height: heightMm });
  } finally {
    host.remove();
  }
  return pdf.output('blob');
}

export async function exportPoster(
  config: PosterConfig,
  { format, quality, onProgress, timeoutMs = 60_000, vector = false }: ExportOptions,
): Promise<ExportResult> {
  if (!config.location) throw new ExportError('Choose a location first.');

  const layout = computeLayout(config);
  const { width, height, dpi } = exportPixelSize(config.paperSize, config.orientation, quality);

  if (vector && format !== 'png') {
    onProgress?.('Preparing fonts…');
    // Text is measured with the real fonts so that outlines match the preview.
    await loadPosterFonts(config.titleFont, config.bodyFont);
    const blob = await exportVector(config, layout, format, onProgress);
    return { blob, filename: exportFilename(config, format), width, height, dpi, vector: true };
  }
  const scale = width / layout.width;

  onProgress?.('Preparing fonts…');
  await loadPosterFonts(config.titleFont, config.bodyFont);
  const fontCss = await embeddedFontCss(config.titleFont, config.bodyFont);

  onProgress?.(`Rendering the map at ${width} × ${height} px…`);
  const mapCanvas = await renderMap(config, layout, scale, timeoutMs);

  onProgress?.('Composing the poster…');
  let blob: Blob;

  if (format === 'svg') {
    const { mapArea, mapView } = layout;
    const mapImage = mapCanvas.toDataURL('image/png');
    const { widthMm, heightMm } = paperDimensionsMm(config.paperSize, config.orientation);
    const underlay = (
      <>
        <rect width={layout.width} height={layout.height} fill={config.posterBackground} />
        <clipPath id="export-map-area">
          <rect x={mapArea.x} y={mapArea.y} width={mapArea.width} height={mapArea.height} />
        </clipPath>
        <image
          href={mapImage}
          x={mapView.x}
          y={mapView.y}
          width={mapView.width}
          height={mapView.height}
          clipPath="url(#export-map-area)"
          preserveAspectRatio="none"
        />
      </>
    );
    const markup = overlayMarkup(
      config,
      layout,
      fontCss,
      {
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
      },
      underlay,
    );
    blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', markup], {
      type: 'image/svg+xml',
    });
  } else {
    const canvas = await composeRaster(config, layout, mapCanvas, fontCss, width, height);
    if (format === 'png') {
      blob = await canvasToBlob(canvas, 'image/png');
    } else {
      onProgress?.('Creating the PDF…');
      const { jsPDF } = await import('jspdf');
      const { widthMm, heightMm } = paperDimensionsMm(config.paperSize, config.orientation);
      const pdf = new jsPDF({
        orientation: widthMm > heightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
        compress: true,
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, widthMm, heightMm);
      blob = pdf.output('blob');
    }
  }

  return { blob, filename: exportFilename(config, format), width, height, dpi };
}
