import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import raw from './fixtures/raw-mini.json';
import type { PublicFile, RawFile } from '../src/shared/types';
import { sanitize } from '../scripts/lib/sanitize';

const graph = vi.hoisted(() => ({
  people: new Map<string, unknown>(),
  families: new Map<string, unknown>(),
  fail: false,
}));

vi.mock('../src/data/api', () => ({
  getPerson: async (id: string) => {
    if (graph.fail) throw new Error('boom');
    return graph.people.get(id);
  },
  getFamily: async (id: string) => graph.families.get(id),
}));

import { PersonPage } from '../src/pages/PersonPage';

function load(file: PublicFile) {
  graph.people = new Map(file.individuals.map((p) => [p.id, p]));
  graph.families = new Map(file.families.map((f) => [f.id, f]));
}

beforeEach(() => {
  graph.fail = false;
  load(sanitize(raw as RawFile, {}).file);
});

const hrefs = (name: string | RegExp) => screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));

describe('PersonPage', () => {
  it('shows a deceased person with eyebrow, timeline and family', async () => {
    render(<PersonPage id="I2" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hayden Gitt Bryan' })).toBeInTheDocument();
    expect(screen.getByText('Born 1908 in Atlantic City NJ · Died 1960 in Philadelphia PA')).toBeInTheDocument();
    expect(document.title).toBe('Hayden Gitt Bryan · Bryan Family Tree');

    const timeline = screen.getByRole('list', { name: 'Life timeline' });
    expect(within(timeline).getByText('1908')).toBeInTheDocument();
    expect(within(timeline).getByText('Born')).toBeInTheDocument();
    expect(within(timeline).getByText('Died')).toBeInTheDocument();

    expect(screen.getByText('Parents · go up')).toBeInTheDocument();
    expect(hrefs('Oliver Bryan')).toEqual(['#/person/I4']);
    expect(hrefs('Bessie Ida Gitt')).toEqual(['#/person/I5']);
    expect(screen.getByText('Spouse · married 1943')).toBeInTheDocument();
    expect(hrefs('Pauline Agnes Thorp')).toEqual(['#/person/I3']);
    expect(screen.getByText('Children · go down')).toBeInTheDocument();
    expect(hrefs('Stephen Thomas Bryan')).toEqual(['#/person/I1']);
    expect(screen.getByText('Siblings')).toBeInTheDocument();
    expect(hrefs('Edwin Bryan')).toEqual(['#/person/I9']);
  });

  it('shows a living child as a name only', async () => {
    render(<PersonPage id="I2" />);
    await screen.findByRole('heading', { level: 1 });
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('1948');
    expect(text).not.toContain('Scranton PA');
    expect(screen.getByText('Living person')).toBeInTheDocument();
  });

  it('lists other parent families', async () => {
    render(<PersonPage id="I9" />);
    expect(await screen.findByText('Also listed as a child of')).toBeInTheDocument();
    expect(hrefs('Benjamin Sherman Bryan')).toEqual(['#/person/I6']);
  });

  it('hides everything private on a living person page', async () => {
    render(<PersonPage id="I1" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Stephen Thomas Bryan' })).toBeInTheDocument();
    expect(screen.getByText('Living person. Details are hidden.')).toBeInTheDocument();
    expect(screen.queryByText('Life timeline')).toBeNull();
    const text = document.body.textContent ?? '';
    for (const s of ['Scranton PA', '1948', 'English Village', 'Saunders', 'Advertising Copywriter']) {
      expect(text).not.toContain(s);
    }
    expect(hrefs('Hayden Gitt Bryan')).toEqual(['#/person/I2']);
  });

  it('shows Partner not recorded when a family has no spouse', async () => {
    render(<PersonPage id="I13" />);
    expect(await screen.findByText('Partner not recorded')).toBeInTheDocument();
    expect(hrefs('Sam Bryan')).toEqual(['#/person/I12']);
  });

  it('renders a person with no families without family headings', async () => {
    render(<PersonPage id="I8" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mary' })).toBeInTheDocument();
    for (const h of ['Parents · go up', 'Siblings', 'Children · go down']) expect(screen.queryByText(h)).toBeNull();
    expect(screen.queryByText('Life timeline')).toBeNull();
    expect(screen.getByText('No family links recorded.')).toBeInTheDocument();
  });

  it('renders NotFound for an unknown id', async () => {
    render(<PersonPage id="NOPE" />);
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('links to the family tree', async () => {
    render(<PersonPage id="I4" />);
    const link = await screen.findByRole('link', { name: /in the family tree/ });
    expect(link).toHaveAttribute('href', '#/tree/I4');
  });

  it('shows a friendly error when loading fails', async () => {
    graph.fail = true;
    render(<PersonPage id="I2" />);
    expect(await screen.findByText('This page could not be loaded. Please try again.')).toBeInTheDocument();
  });

  it('ignores stale loads when the id changes', async () => {
    const { rerender } = render(<PersonPage id="I2" />);
    rerender(<PersonPage id="I4" />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Oliver Bryan'));
    expect(document.title).toBe('Oliver Bryan · Bryan Family Tree');
  });
});
