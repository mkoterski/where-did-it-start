import { useState } from 'react';
import { encodeShareState, SHARE_PARAM } from '../domain/config';
import { EXPORT_QUALITIES, exportPixelSize, type ExportQuality } from '../domain/paper';
import type { PosterConfig } from '../domain/types';
import type { ExportFormat } from '../export/exportPoster';
import { SelectField } from './controls';

type ExportState =
  | { status: 'idle' }
  | { status: 'working'; format: ExportFormat; message: string }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string };

interface ExportPanelProps {
  config: PosterConfig;
  onReset(): void;
  onUndoReset?: () => void;
}

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: 'png', label: 'Download PNG', hint: 'Image for printing or sharing' },
  { format: 'pdf', label: 'PDF', hint: 'Print-ready page in the chosen paper size' },
  { format: 'svg', label: 'SVG', hint: 'Vector text and shapes, embedded map image' },
];

export function ExportPanel({ config, onReset, onUndoReset }: ExportPanelProps) {
  const [quality, setQuality] = useState<ExportQuality>('print');
  const [state, setState] = useState<ExportState>({ status: 'idle' });
  const [shareMessage, setShareMessage] = useState('');
  const disabled = !config.location || state.status === 'working';
  const size = exportPixelSize(config.paperSize, config.orientation, quality);

  const runExport = async (format: ExportFormat) => {
    setState({ status: 'working', format, message: 'Starting export…' });
    try {
      const [{ exportPoster }, { downloadBlob }] = await Promise.all([
        import('../export/exportPoster'),
        import('../export/filename'),
      ]);
      const result = await exportPoster(config, {
        format,
        quality,
        onProgress: (message) => setState({ status: 'working', format, message }),
      });
      downloadBlob(result.blob, result.filename);
      setState({
        status: 'done',
        message: `Saved ${result.filename} (${result.width} × ${result.height} px, ${result.dpi} dpi).`,
      });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof Error && error.name === 'ExportError'
            ? error.message
            : 'The export failed. Please try again, or choose Standard quality.',
      });
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = `${SHARE_PARAM}=${encodeShareState(config)}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareMessage('Link copied. Anyone with the link can open this design.');
    } catch {
      window.history.replaceState(null, '', url.toString());
      setShareMessage('Copy the address from your browser bar to share this design.');
    }
  };

  return (
    <section className="export" aria-labelledby="export-heading">
      <h2 id="export-heading" className="visually-hidden">
        Download
      </h2>
      <div className="export__main">
        <div className="export__quality">
          <SelectField<ExportQuality>
            label="Download quality"
            value={quality}
            onChange={setQuality}
            options={(Object.keys(EXPORT_QUALITIES) as ExportQuality[]).map((key) => ({
              value: key,
              label: EXPORT_QUALITIES[key].label,
            }))}
          />
          <p className="field__hint export__size">
            {size.width} × {size.height} px
            {size.dpi < EXPORT_QUALITIES[quality].dpi
              ? ` · ${size.dpi} dpi (capped for this paper size)`
              : ''}
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
              title={hint}
            >
              {state.status === 'working' && state.format === format ? 'Exporting…' : label}
            </button>
          ))}
        </div>
      </div>
      <p
        className={`export__status${state.status === 'error' ? ' export__status--error' : ''}`}
        role={state.status === 'error' ? 'alert' : 'status'}
      >
        {!config.location
          ? 'Choose a place first to enable the download.'
          : state.status === 'idle'
            ? ''
            : state.message}
      </p>
      <div className="export__secondary">
        <button type="button" className="link-button" onClick={share}>
          Copy share link
        </button>
        <button type="button" className="link-button" onClick={onReset}>
          Reset design
        </button>
        {onUndoReset ? (
          <button type="button" className="link-button" onClick={onUndoReset}>
            Undo reset
          </button>
        ) : null}
        <p className="field__hint" role="status">
          {shareMessage ||
            (onUndoReset ? 'Design reset to the defaults. Your place was kept.' : '')}
        </p>
      </div>
    </section>
  );
}
