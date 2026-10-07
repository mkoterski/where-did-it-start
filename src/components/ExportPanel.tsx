import { useEffect, useState } from 'react';
import { encodeShareState, SHARE_PARAM } from '../domain/config';
import {
  EXPORT_QUALITIES,
  exportPixelSize,
  paperDimensionsMm,
  type ExportQuality,
} from '../domain/paper';
import type { PosterConfig } from '../domain/types';
import type { ExportError, ExportFormat } from '../export/exportPoster';
import {
  isStaleBuildError,
  loadExporter,
  loadFileHelpers,
  preloadExportModules,
} from '../export/loadExport';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
import { STORAGE_KEY } from '../state/usePosterState';
import { Segmented, SelectField } from './controls';

type ExportState =
  | { status: 'idle' }
  | { status: 'working'; format: ExportFormat; message: string }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string }
  /** The site was updated since this tab was opened; a reload fixes it. */
  | { status: 'stale' };

interface ExportPanelProps {
  config: PosterConfig;
  onReset(): void;
  onUndoReset?: () => void;
}

const FORMATS: Array<{ format: ExportFormat; label: MessageKey; hint: MessageKey }> = [
  { format: 'png', label: 'export.png', hint: 'export.hint.png' },
  { format: 'pdf', label: 'export.pdf', hint: 'export.hint.pdf' },
  { format: 'svg', label: 'export.svg', hint: 'export.hint.svg' },
];

/** Checked by name: importing the class would pull the export code into the main bundle. */
function isExportError(error: unknown): error is ExportError {
  return error instanceof Error && error.name === 'ExportError' && 'key' in error;
}

export function ExportPanel({ config, onReset, onUndoReset }: ExportPanelProps) {
  const { t, lang } = useI18n();
  const [quality, setQuality] = useState<ExportQuality>('print');
  const [vectorMode, setVectorMode] = useState<'vector' | 'image'>('vector');
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const [shareMessage, setShareMessage] = useState('');
  const disabled = !config.location || state.status === 'working';
  const size = exportPixelSize(config.paperSize, config.orientation, quality);
  const { widthMm, heightMm } = paperDimensionsMm(config.paperSize, config.orientation);
  const cm = (mm: number) => (mm / 10).toLocaleString(lang);
  const paperLabel = `${cm(widthMm)} × ${cm(heightMm)} cm`;
  const hasLocation = config.location !== null;

  // Load the export code in the background once a download becomes possible.
  useEffect(() => {
    if (!hasLocation) return;
    const idle =
      window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => preloadExportModules());
    return () => cancel(handle);
  }, [hasLocation]);

  const reloadKeepingDesign = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Without storage the shared link in the address bar still restores the design.
      const url = new URL(window.location.href);
      url.hash = `${SHARE_PARAM}=${encodeShareState(config)}`;
      window.history.replaceState(null, '', url.toString());
    }
    window.location.reload();
  };

  const runExport = async (format: ExportFormat) => {
    setState({ status: 'working', format, message: t('export.starting') });
    try {
      const [{ exportPoster }, { downloadBlob }] = await Promise.all([
        loadExporter(),
        loadFileHelpers(),
      ]);
      const result = await exportPoster(config, {
        format,
        quality,
        vector: vectorMode === 'vector',
        filenamePrefix: t('defaults.filename'),
        onProgress: (key, params) =>
          setState({ status: 'working', format, message: t(key, params) }),
      });
      downloadBlob(result.blob, result.filename);
      setState({
        status: 'done',
        message: result.vector
          ? t('export.savedVector', { filename: result.filename, paper: paperLabel })
          : t('export.savedImage', {
              filename: result.filename,
              width: result.width,
              height: result.height,
              dpi: result.dpi,
            }),
      });
    } catch (error) {
      if (isStaleBuildError(error)) {
        setState({ status: 'stale' });
        return;
      }
      console.error('Poster export failed', error);
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      setState({
        status: 'error',
        message: isExportError(error) ? t(error.key) : t('export.failed', { detail }),
      });
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = `${SHARE_PARAM}=${encodeShareState(config)}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareMessage(t('export.linkCopied'));
    } catch {
      window.history.replaceState(null, '', url.toString());
      setShareMessage(t('export.copyFromBar'));
    }
  };

  return (
    <section className="export" aria-labelledby="export-heading">
      <h2 id="export-heading" className="visually-hidden">
        {t('export.heading')}
      </h2>
      <div className="export__vector">
        <Segmented<'vector' | 'image'>
          legend={t('export.asLegend')}
          value={vectorMode}
          onChange={setVectorMode}
          options={[
            { value: 'vector', label: t('export.vector') },
            { value: 'image', label: t('export.image') },
          ]}
        />
      </div>
      <div className="export__main">
        <div className="export__quality">
          <SelectField<ExportQuality>
            label={vectorMode === 'vector' ? t('export.pngQuality') : t('export.quality')}
            value={quality}
            onChange={setQuality}
            options={(Object.keys(EXPORT_QUALITIES) as ExportQuality[]).map((key) => ({
              value: key,
              label: t(`quality.${key}`),
            }))}
          />
          <p className="field__hint export__size">
            {size.width} × {size.height} px
            {size.dpi < EXPORT_QUALITIES[quality].dpi ? t('export.capped', { dpi: size.dpi }) : ''}
          </p>
        </div>
        <div className="export__buttons">
          {FORMATS.map(({ format, label, hint }) => (
            <button
              key={format}
              type="button"
              className={`button${format === 'png' ? ' button--primary' : ''}`}
              onClick={() => runExport(format)}
              disabled={disabled}
              title={t(hint)}
            >
              {state.status === 'working' && state.format === format
                ? t('export.exporting')
                : t(label)}
            </button>
          ))}
        </div>
      </div>
      {state.status === 'stale' ? (
        <div className="export__stale" role="alert">
          <p>{t('export.stale')}</p>
          <button type="button" className="button button--primary" onClick={reloadKeepingDesign}>
            {t('export.reload')}
          </button>
        </div>
      ) : (
        <p
          className={`export__status${state.status === 'error' ? ' export__status--error' : ''}`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {!config.location
            ? t('export.choosePlace')
            : state.status === 'idle'
              ? ''
              : state.message}
        </p>
      )}
      <div className="export__secondary">
        <button type="button" className="link-button" onClick={share}>
          {t('export.share')}
        </button>
        <button type="button" className="link-button" onClick={onReset}>
          {t('export.reset')}
        </button>
        {onUndoReset ? (
          <button type="button" className="link-button" onClick={onUndoReset}>
            {t('export.undo')}
          </button>
        ) : null}
        <p className="field__hint" role="status">
          {shareMessage || (onUndoReset ? t('export.resetDone') : '')}
        </p>
      </div>
    </section>
  );
}
