import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { LocationSelection } from './domain/types';
import { STORAGE_KEY } from './state/usePosterState';

// WebGL maps cannot run in jsdom; their behaviour is covered by the browser QA checklist.
const mapProps = vi.hoisted(() => ({
  current: null as null | { onPick(latitude: number, longitude: number, final?: boolean): void },
}));
vi.mock('./components/InteractiveMap', () => ({
  InteractiveMap: (props: {
    onPick(latitude: number, longitude: number, final?: boolean): void;
  }) => {
    mapProps.current = props;
    return <div data-testid="interactive-map" />;
  },
}));
vi.mock('./components/PosterMap', () => ({
  PosterMap: () => <div data-testid="poster-map" />,
}));

const geocoder = vi.hoisted(() => ({
  name: 'Test',
  attribution: 'Search by Test',
  search: vi.fn(),
  reverse: vi.fn(),
}));
vi.mock('./geocoding/provider', () => ({ geocoder }));

const exportPoster = vi.hoisted(() => vi.fn());
vi.mock('./export/exportPoster', () => ({ exportPoster }));
const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('./export/filename', async (original) => ({
  ...(await original<typeof import('./export/filename')>()),
  downloadBlob,
}));

const BERLIN: LocationSelection = {
  latitude: 52.509652,
  longitude: 13.37603,
  displayName: 'Potsdamer Platz, Tiergarten, Mitte, Berlin, Deutschland',
  name: 'Potsdamer Platz',
  city: 'Berlin',
  country: 'Deutschland',
};
const HAMBURG: LocationSelection = {
  latitude: 53.5461,
  longitude: 9.9661,
  displayName: 'Potsdamer Platz, Hamburg, Deutschland',
  name: 'Potsdamer Platz',
  city: 'Hamburg',
};

function poster() {
  return screen.getByRole('img', { name: /poster preview/i });
}

function posterText() {
  return poster().querySelector('svg')!.textContent;
}

async function searchAndSelect(user: ReturnType<typeof userEvent.setup>) {
  geocoder.search.mockResolvedValueOnce([BERLIN, HAMBURG]);
  await user.type(screen.getByLabelText('Address, place or landmark'), 'Potsdamer Platz{Enter}');
  const results = await screen.findByRole('list', { name: 'Search results' });
  await user.click(within(results).getByRole('button', { name: /Berlin/ }));
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('starts with an empty state and default text', () => {
    render(<App />);
    expect(screen.getByText('No place selected yet.')).toBeInTheDocument();
    expect(posterText()).toContain('Where it all began...');
    expect(posterText()).toContain('Anita & Matthias');
    expect(posterText()).toContain('Search for a place to begin');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  });

  it('searches for a place and selects a result', async () => {
    const user = userEvent.setup();
    render(<App />);

    await searchAndSelect(user);

    expect(geocoder.search).toHaveBeenCalledWith('Potsdamer Platz', expect.any(AbortSignal));
    expect(screen.getByText(BERLIN.displayName)).toBeInTheDocument();
    expect(posterText()).toContain('Berlin 52.50965°N 13.37603°E');
    expect(screen.getByLabelText('Place label')).toHaveValue('Berlin');
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  it('lets the keyboard reach search results', async () => {
    const user = userEvent.setup();
    geocoder.search.mockResolvedValueOnce([BERLIN, HAMBURG]);
    render(<App />);
    await user.type(screen.getByLabelText('Address, place or landmark'), 'Potsdamer{Enter}');
    await screen.findByRole('list', { name: 'Search results' });

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveTextContent('Berlin');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveTextContent('Hamburg');
    await user.keyboard('{Enter}');
    expect(posterText()).toContain('Hamburg');
  });

  it('shows empty and error states for searches', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText('Address, place or landmark');

    geocoder.search.mockResolvedValueOnce([]);
    await user.type(input, 'Xyzzy{Enter}');
    expect(await screen.findByText(/No places found for “Xyzzy”/)).toBeInTheDocument();

    geocoder.search.mockRejectedValueOnce(new Error('The place search could not be reached.'));
    await user.type(input, '{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('changes the keyhole shape', async () => {
    const user = userEvent.setup();
    render(<App />);
    const shapes = screen.getByRole('group', { name: 'Shape' });
    expect(within(shapes).getByRole('radio', { name: 'Heart' })).toBeChecked();

    await user.click(within(shapes).getByRole('radio', { name: 'Circle' }));

    expect(within(shapes).getByRole('radio', { name: 'Circle' })).toBeChecked();
    const keyhole = poster().querySelector('mask path');
    expect(keyhole).toHaveAttribute('d', expect.stringMatching(/^M2 50 A48 48/));
  });

  it('remembers the design in this browser', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(
      within(screen.getByRole('group', { name: 'Shape' })).getByRole('radio', { name: 'Diamond' }),
    );
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').frameShape).toBe('diamond'),
    );
    unmount();

    render(<App />);
    expect(
      within(screen.getByRole('group', { name: 'Shape' })).getByRole('radio', { name: 'Diamond' }),
    ).toBeChecked();
  });

  it('updates the poster text live', async () => {
    const user = userEvent.setup();
    render(<App />);
    const title = screen.getByLabelText('Main phrase');
    await user.clear(title);
    await user.type(title, 'Wo alles begann…');
    const names = screen.getByLabelText('Names');
    await user.clear(names);
    await user.type(names, 'Julian & Kathi');

    expect(posterText()).toContain('Wo alles begann…');
    expect(posterText()).toContain('Julian & Kathi');
    expect(screen.getByText('16/40')).toBeInTheDocument();
  });

  it('hides coordinates and switches their format', async () => {
    const user = userEvent.setup();
    render(<App />);
    await searchAndSelect(user);

    await user.selectOptions(screen.getByLabelText('Coordinate format'), 'dms');
    expect(posterText()).toContain('Berlin 52°30\'34.7"N 13°22\'33.7"E');

    await user.click(screen.getByRole('switch', { name: 'Show coordinates' }));
    expect(posterText()).not.toContain('52°');
  });

  it('validates typed coordinates', async () => {
    const user = userEvent.setup();
    geocoder.reverse.mockResolvedValue(null);
    render(<App />);
    await user.click(screen.getByText('Enter coordinates or use your position'));

    await user.type(screen.getByLabelText('Latitude'), '123');
    await user.type(screen.getByLabelText('Longitude'), '13.4');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Latitude must be a number between −90 and 90.')).toBeInTheDocument();
    expect(screen.getByText('No place selected yet.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Latitude'));
    await user.type(screen.getByLabelText('Latitude'), '52.52');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('52.520000°N 13.400000°E')).toBeInTheDocument();
    await waitFor(() =>
      expect(geocoder.reverse).toHaveBeenCalledWith(52.52, 13.4, expect.any(AbortSignal)),
    );
  });

  it('previews a dragged spot live and looks up the place only when it is dropped', async () => {
    const user = userEvent.setup();
    geocoder.reverse.mockResolvedValue({
      ...BERLIN,
      latitude: 52.52,
      longitude: 13.41,
      city: 'Berlin-Mitte',
    });
    render(<App />);
    await searchAndSelect(user);

    act(() => mapProps.current!.onPick(52.515, 13.39, false));
    act(() => mapProps.current!.onPick(52.52, 13.41, false));
    expect(posterText()).toContain('52.52000°N 13.41000°E');
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(geocoder.reverse).not.toHaveBeenCalled();

    act(() => mapProps.current!.onPick(52.52, 13.41, true));
    await waitFor(() =>
      expect(geocoder.reverse).toHaveBeenCalledWith(52.52, 13.41, expect.any(AbortSignal)),
    );
    expect(geocoder.reverse).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(posterText()).toContain('Berlin-Mitte 52.52000°N 13.41000°E'));
  });

  it('resets the design, keeps the place, and can undo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await searchAndSelect(user);
    const title = screen.getByLabelText('Main phrase');
    await user.clear(title);
    await user.type(title, 'Our place');
    await user.click(
      within(screen.getByRole('group', { name: 'Shape' })).getByRole('radio', { name: 'Star' }),
    );

    await user.click(screen.getByRole('button', { name: 'Reset design' }));
    expect(screen.getByLabelText('Main phrase')).toHaveValue('Where it all began...');
    expect(
      within(screen.getByRole('group', { name: 'Shape' })).getByRole('radio', { name: 'Heart' }),
    ).toBeChecked();
    expect(posterText()).toContain('Berlin');

    await user.click(screen.getByRole('button', { name: 'Undo reset' }));
    expect(screen.getByLabelText('Main phrase')).toHaveValue('Our place');
  });

  it('exports the poster with the current design', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['png']);
    exportPoster.mockResolvedValue({
      blob,
      filename: 'where-it-all-began-berlin.png',
      width: 2480,
      height: 3508,
      dpi: 300,
    });
    render(<App />);
    await searchAndSelect(user);

    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(blob, 'where-it-all-began-berlin.png'),
    );
    expect(exportPoster).toHaveBeenCalledWith(
      expect.objectContaining({ location: BERLIN, title: 'Where it all began...' }),
      expect.objectContaining({ format: 'png', quality: 'print' }),
    );
    expect(screen.getByText(/Saved where-it-all-began-berlin.png/)).toBeInTheDocument();
  });

  it('reports export failures instead of failing silently', async () => {
    const user = userEvent.setup();
    const error = new Error('Some map tiles could not be loaded.');
    error.name = 'ExportError';
    exportPoster.mockRejectedValue(error);
    render(<App />);
    await searchAndSelect(user);

    await user.click(screen.getByRole('button', { name: 'PDF' }));

    expect(await screen.findByText('Some map tiles could not be loaded.')).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('asks for a reload when the site was updated while the tab was open', async () => {
    const user = userEvent.setup();
    exportPoster.mockRejectedValue(
      new TypeError(
        'Failed to fetch dynamically imported module: https://example.test/assets/exportPoster-old.js',
      ),
    );
    render(<App />);
    await searchAndSelect(user);

    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This page was updated since you opened it',
    );
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('shows the underlying reason for unexpected export errors', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exportPoster.mockRejectedValue(new Error('WebGL context lost'));
    render(<App />);
    await searchAndSelect(user);

    await user.click(screen.getByRole('button', { name: 'SVG' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The export failed (WebGL context lost). Please try again, or choose Standard quality.',
    );
  });

  it('restores a shared design from the URL', () => {
    window.location.hash =
      '#poster=' +
      btoa(JSON.stringify({ names: 'Julian & Kathi', frameShape: 'circle' })).replace(/=+$/, '');
    render(<App />);
    expect(screen.getByLabelText('Names')).toHaveValue('Julian & Kathi');
    expect(
      within(screen.getByRole('group', { name: 'Shape' })).getByRole('radio', { name: 'Circle' }),
    ).toBeChecked();
    expect(window.location.hash).toBe('');
  });
});
