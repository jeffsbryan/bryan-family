import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { PublicFile, RawFile } from '../src/shared/types';
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

const hrefs = (name: string | RegExp) => screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));

describe('TreePage', () => {
  it('shows the four columns for a person with grandparents', async () => {
    render(<TreePage id="I2" />);
    for (const h of ['Grandparents', 'Parents', 'Selected person', 'Children']) {
      expect(await screen.findByRole('heading', { name: h })).toBeInTheDocument();
    }
    expect(document.title).toBe('Hayden Gitt Bryan · Family tree · Bryan Family Tree');
    const label = screen.getByRole('heading', { name: 'Grandparents' });
    expect(label.className).toContain('tree-gp-label');
    expect(label.classList.contains('sr-only')).toBe(false);
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

  it('shows an arrow where an ancestor has more ancestors beyond the shown levels', async () => {
    // Add a great-grandfather above I6 so I6 (a grandparent) has parents that are not shown.
    const i6 = graph.people.get('I6') as { childOfFamilies: string[] };
    i6.childOfFamilies = ['FX'];
    graph.people.set('IX', { id: 'IX', name: 'Great Grand', living: false, events: [], childOfFamilies: [], spouseOfFamilies: ['FX'] });
    graph.families.set('FX', { id: 'FX', children: ['I6'], husband: 'IX' });
    render(<TreePage id="I2" />);
    await screen.findByRole('heading', { name: 'Parents' });
    const benjamin = screen.getByRole('link', { name: /^More ancestors Benjamin Sherman Bryan/ });
    expect(within(benjamin).getByText('More ancestors')).toBeInTheDocument();
    expect(benjamin.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Great Grand/ })).toBeNull();
    expect(screen.getAllByText('More ancestors')).toHaveLength(1);
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
    expect(document.title).toBe('Mary · Family tree · Bryan Family Tree');
    await act(async () => {
      release();
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(screen.getByRole('link', { name: 'Details for Mary' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Details for Hayden Gitt Bryan' })).toBeNull();
    expect(document.title).toBe('Mary · Family tree · Bryan Family Tree');
  });
});
