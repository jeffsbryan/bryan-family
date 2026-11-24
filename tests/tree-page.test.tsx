import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { PublicFile, PublicPerson, RawFile } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';

const graph = vi.hoisted(() => ({
  people: new Map<string, unknown>(),
  families: new Map<string, unknown>(),
  fail: false,
  delay: {} as Record<string, Promise<void>>,
}));

vi.mock('../src/data/api', () => ({
  getPerson: async (id: string) => {
    if (graph.fail) throw new Error('boom');
    await graph.delay[id];
    return graph.people.get(id);
  },
  getFamily: async (id: string) => graph.families.get(id),
}));

import { TreePage } from '../src/pages/TreePage';

function load(file: PublicFile) {
  graph.people = new Map(file.individuals.map((p) => [p.id, p]));
  graph.families = new Map(file.families.map((f) => [f.id, f]));
}

beforeEach(() => {
  graph.fail = false;
  graph.delay = {};
  load(sanitize(raw as RawFile, {}).file);
  document.title = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

const hrefs = (name: string | RegExp) => screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));

describe('TreePage', () => {
  it('shows the four columns for a person with grandparents', async () => {
    render(<TreePage id="I2" />);
    for (const h of ['Grandparents', 'Parents', 'Selected person', 'Children']) {
      expect(await screen.findByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(document.title).toBe('Hayden Gitt Bryan · Family tree · Bryan Family Tree');
  });

  it('links each card to its own tree and each Details link to the person page', async () => {
    render(<TreePage id="I2" />);
    await screen.findByRole('heading', { name: 'Parents' });
    expect(hrefs(/^Oliver Bryan/)).toEqual(['#/tree/I4']);
    expect(hrefs(/^Bessie Ida Gitt/)).toEqual(['#/tree/I5']);
    expect(hrefs(/^Benjamin Sherman Bryan/)).toEqual(['#/tree/I6']);
    expect(hrefs(/^Maria Louise Hayden/)).toEqual(['#/tree/I7']);
    expect(hrefs('Details for Oliver Bryan')).toEqual(['#/person/I4']);
    expect(hrefs('Details for Bessie Ida Gitt')).toEqual(['#/person/I5']);
    expect(hrefs('Details for Benjamin Sherman Bryan')).toEqual(['#/person/I6']);
    expect(hrefs('Details for Maria Louise Hayden')).toEqual(['#/person/I7']);
    expect(hrefs('Details for Hayden Gitt Bryan')).toEqual(['#/person/I2']);
  });

  it('shows lifespans, the spouse chip and living children as name-only cards', async () => {
    render(<TreePage id="I2" />);
    await screen.findByRole('heading', { name: 'Parents' });
    const oliver = screen.getByRole('link', { name: /^Oliver Bryan/ });
    expect(within(oliver).getByText('1870 – 1931')).toBeInTheDocument();

    expect(hrefs(/Pauline Agnes Thorp/)).toEqual(['#/tree/I3']);
    expect(screen.getByRole('heading', { name: 'Spouse' })).toBeInTheDocument();

    const child = screen.getByRole('link', { name: /^Stephen Thomas Bryan/ });
    expect(child.getAttribute('href')).toBe('#/tree/I1');
    expect(within(child).getByText('Living person')).toBeInTheDocument();
    const card = child.closest('.tree-card') as HTMLElement;
    expect(card.className).toContain('is-living');
    for (const hidden of ['Scranton PA', '1948', 'English Village']) {
      expect(screen.queryByText(new RegExp(hidden))).toBeNull();
    }
    expect(card.textContent).not.toMatch(/\d{4}/);
  });

  it('shows an arrow where a shallow ancestor has more ancestors', async () => {
    const family = await import('../src/data/family');
    const spy = vi.spyOn(family, 'getTreeView');
    const p = (id: string) => graph.people.get(id) as PublicPerson;
    spy.mockResolvedValue({
      root: {
        person: p('I2'),
        hasMoreAncestors: false,
        parents: [
          { person: p('I4'), parents: [], hasMoreAncestors: true },
          { person: p('I5'), parents: [], hasMoreAncestors: false },
        ],
      },
      spouses: [],
      children: [],
    });
    render(<TreePage id="I2" />);
    await screen.findByRole('heading', { name: 'Parents' });
    expect(screen.queryByRole('heading', { name: 'Grandparents' })).toBeNull();
    const oliver = screen.getByRole('link', { name: /^More ancestors Oliver Bryan/ });
    expect(within(oliver).getByText('More ancestors')).toBeInTheDocument();
    expect(oliver.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // Bessie has no parents so gets no arrow
    expect(within(screen.getByRole('link', { name: /^Bessie Ida Gitt/ })).queryByText('More ancestors')).toBeNull();
  });

  it('shows no parent or child headings for a person with no families', async () => {
    render(<TreePage id="I8" />);
    expect(await screen.findByRole('heading', { name: 'Selected person' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Parents' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Grandparents' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Children' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /^Spouse/ })).toBeNull();
    expect(hrefs('Details for Mary')).toEqual(['#/person/I8']);
  });

  it('renders a single parent without a broken bracket', async () => {
    const fam = graph.families.get('F2') as { wife?: string };
    delete fam.wife;
    render(<TreePage id="I2" />);
    await screen.findByRole('heading', { name: 'Parents' });
    expect(screen.getAllByRole('link', { name: /^Oliver Bryan/ })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /^Bessie/ })).toBeNull();
  });

  it('renders NotFound for an unknown id', async () => {
    render(<TreePage id="NOPE" />);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(document.title).toBe('Family tree · Bryan Family Tree');
  });

  it('shows a friendly error when loading fails', async () => {
    graph.fail = true;
    render(<TreePage id="I2" />);
    expect(await screen.findByText('This page could not be loaded. Please try again.')).toBeInTheDocument();
    expect(document.title).toBe('Family tree · Bryan Family Tree');
  });

  it('shows Loading while pending', async () => {
    render(<TreePage id="I2" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(document.title).toBe('Family tree · Bryan Family Tree');
    await screen.findByRole('heading', { name: 'Selected person' });
  });

  it('ignores a stale load when the id changes', async () => {
    let release!: () => void;
    graph.delay.I2 = new Promise<void>((r) => (release = r));
    const { rerender } = render(<TreePage id="I2" />);
    rerender(<TreePage id="I8" />);
    expect(await screen.findByRole('link', { name: 'Details for Mary' })).toBeInTheDocument();
    release();
    await new Promise((r) => setTimeout(r, 20));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Details for Hayden Gitt Bryan' })).toBeNull());
    expect(document.title).toBe('Mary · Family tree · Bryan Family Tree');
  });
});
