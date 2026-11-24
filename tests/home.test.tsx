import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { SearchBox } from '../src/components/SearchBox';
import { Home } from '../src/pages/Home';
import { SurnamePage } from '../src/pages/SurnamePage';
import { App } from '../src/App';
import * as api from '../src/data/api';

vi.mock('../src/data/api');

const manifest = {
  generatedAt: '2026-01-01', personCount: 27981, familyCount: 12510, bucketCount: 200,
  topSurnames: [{ surname: 'Bryan', count: 221 }, { surname: 'Hayden', count: 140 }],
};

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.resetAllMocks();
  vi.mocked(api.getManifest).mockResolvedValue(manifest);
});

describe('Home', () => {
  it('shows counts, surname chips and search results', async () => {
    vi.mocked(api.searchPeople).mockResolvedValue([
      ['I1', 'Ada Hayden', 1870, 1931, false],
      ['I2', 'Zed Hayden', null, null, true],
      ['I5', 'Old Hayden', null, null, false],
    ]);
    render(<Home />);
    expect(await screen.findByText(/27,981 people in 12,510 families/)).toBeInTheDocument();
    const chip = screen.getByRole('link', { name: /Bryan/ });
    expect(chip).toHaveAttribute('href', '#/surname/Bryan');

    fireEvent.change(screen.getByLabelText('Search for a person'), { target: { value: 'hay' } });
    const link = await screen.findByRole('link', { name: 'Ada Hayden' });
    expect(link).toHaveAttribute('href', '#/person/I1');
    expect(screen.getByText('1870 – 1931')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zed Hayden' })).toHaveAttribute('href', '#/person/I2');
    expect(screen.getAllByText('Living person')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Old Hayden' })).toBeInTheDocument();
  });
});

describe('SearchBox', () => {
  it('shows nothing for 0 or 1 characters and No one found for empty 2+ results', async () => {
    vi.mocked(api.searchPeople).mockResolvedValue([]);
    render(<SearchBox />);
    const input = screen.getByLabelText('Search for a person');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.queryByText('No one found')).not.toBeInTheDocument();
    expect(api.searchPeople).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'zz' } });
    expect(await screen.findByText('No one found')).toBeInTheDocument();
  });

  it('ignores stale responses', async () => {
    let resolveFirst!: (v: import("../src/shared/types").SearchEntry[]) => void;
    vi.mocked(api.searchPeople)
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([['I2', 'Second Result', 1900, 1950, false]]);
    render(<SearchBox />);
    const input = screen.getByLabelText('Search for a person');
    fireEvent.change(input, { target: { value: 'fi' } });
    fireEvent.change(input, { target: { value: 'sec' } });
    await screen.findByRole('link', { name: 'Second Result' });
    await act(async () => resolveFirst([['I1', 'First Result', 1800, 1850, false]]));
    expect(screen.queryByRole('link', { name: 'First Result' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Second Result' })).toBeInTheDocument();
  });
});

describe('SurnamePage', () => {
  it('lists matching people sorted by name', async () => {
    vi.mocked(api.loadShard).mockResolvedValue([
      ['I3', 'Zoe Bryan', 1900, 1960, false],
      ['I1', 'Amy Bryan', 1880, null, false],
      ['I4', 'Bryan Smith', 1900, 1960, false],
    ]);
    render(<SurnamePage surname="Bryan" />);
    const links = await screen.findAllByRole('link', { name: /Bryan$/ });
    expect(links.map((l) => l.textContent).filter((t) => t !== 'Back to search')).toEqual(['Amy Bryan', 'Zoe Bryan']);
  });
  it('shows No one found', async () => {
    vi.mocked(api.loadShard).mockResolvedValue([]);
    render(<SurnamePage surname="Nobody" />);
    expect(await screen.findByText('No one found')).toBeInTheDocument();
  });
});

describe('App routing', () => {
  it('renders pending and not found routes', async () => {
    window.location.hash = '#/person/I1';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    await act(async () => {
      window.location.hash = '#/nonsense';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument());
  });
});
