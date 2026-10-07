import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { loadPosterFonts } from '../domain/fontLoading';
import type { PosterLayout } from '../domain/layout';
import { getShape } from '../domain/shapes';
import type { BodyFont, PosterConfig, TitleFont } from '../domain/types';
import { PosterMap, type MapStatus } from './PosterMap';
import { PosterOverlay } from './PosterOverlay';

/** Re-renders once web fonts have loaded, so SVG text is measured with the real glyphs. */
function useFontsVersion(titleFont: TitleFont, bodyFont: BodyFont): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    loadPosterFonts(titleFont, bodyFont).then(() => active && setVersion((v) => v + 1));
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    const bump = () => setVersion((v) => v + 1);
    fonts?.addEventListener?.('loadingdone', bump);
    return () => {
      active = false;
      fonts?.removeEventListener?.('loadingdone', bump);
    };
  }, [titleFont, bodyFont]);
  return version;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

const FRAME_PADDING: Record<PosterConfig['previewFrame'], number> = {
  none: 0,
  black: 14,
  white: 14,
  oak: 16,
};

export function PosterPreview({ config, layout }: { config: PosterConfig; layout: PosterLayout }) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const fontsVersion = useFontsVersion(config.titleFont, config.bodyFont);

  const frame = FRAME_PADDING[config.previewFrame];
  const availableWidth = Math.max(0, stage.width - frame * 2);
  const availableHeight = Math.max(0, stage.height - frame * 2);
  const scale =
    stage.width > 0
      ? Math.min(availableWidth / layout.width, availableHeight / layout.height || Infinity)
      : 0.4;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const pixelRatio = Math.max(1, Math.round(scale * dpr * 4) / 4);

  const description = config.location
    ? `Poster preview: ${getShape(config.frameShape).label.toLowerCase()}-shaped map of ${
        config.locationLabel || config.location.displayName
      } with the text “${config.title}”${config.names ? ` and “${config.names}”` : ''}.`
    : 'Poster preview. Choose a place to see your map.';

  return (
    <div
      className="preview"
      ref={stageRef}
      style={
        {
          '--poster-ratio': `${layout.width + frame * 2} / ${layout.height + frame * 2}`,
        } as CSSProperties
      }
    >
      <div
        className={`preview__frame preview__frame--${config.previewFrame}`}
        style={{
          width: layout.width * scale + frame * 2,
          height: layout.height * scale + frame * 2,
          padding: frame,
        }}
        role="img"
        aria-label={description}
      >
        <div
          className="poster"
          data-fonts={fontsVersion}
          style={{
            width: layout.width,
            height: layout.height,
            transform: `scale(${scale})`,
            background: config.posterBackground,
          }}
        >
          <PosterMap
            config={config}
            layout={layout}
            pixelRatio={pixelRatio}
            onStatusChange={setMapStatus}
          />
          <PosterOverlay
            className="poster__overlay"
            config={config}
            layout={layout}
            idPrefix="preview"
            mode="preview"
          />
        </div>
      </div>
      {config.location && mapStatus !== 'ready' ? (
        <p
          className={`map-chip preview__status${mapStatus === 'error' ? ' preview__status--error' : ''}`}
          role="status"
        >
          {mapStatus === 'loading'
            ? 'Loading map…'
            : 'Some map tiles could not be loaded. Check your connection.'}
        </p>
      ) : null}
    </div>
  );
}
