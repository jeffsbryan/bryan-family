import { describe, it, expect } from 'vitest';
import { normalizePlace, cleanEvents } from '../src/shared/places';
import type { RawEvent } from '../src/shared/types';

describe('normalizePlace', () => {
  it('drops trailing United States', () => {
    expect(normalizePlace('Atlantic City Ward 3, Atlantic, New Jersey, United States')).toBe(
      'Atlantic City Ward 3, Atlantic, New Jersey',
    );
  });
  it('leaves places without suffix alone', () => {
    expect(normalizePlace('Philadelphia PA')).toBe('Philadelphia PA');
  });
  it('drops trailing USA', () => {
    expect(normalizePlace('Lower Merion, Montgomery, Pennsylvania, USA')).toBe(
      'Lower Merion, Montgomery, Pennsylvania',
    );
  });
  it('handles trailing whitespace and repeated spaces', () => {
    expect(normalizePlace('  Town,   County, USA  ')).toBe('Town, County');
  });
  it('drops only one suffix', () => {
    expect(normalizePlace('X, USA, United States')).toBe('X, USA');
  });
});

describe('cleanEvents', () => {
  const ev = (o: Partial<RawEvent> = {}): RawEvent => ({
    type: 'RESI', label: 'Residence', year: 1910, date: '1910', place: 'Town, County, USA', ...o,
  });
  it('collapses identical events and keeps the first, in order', () => {
    const b = ev({ type: 'BIRT', year: 1900, date: '1900' });
    const out = cleanEvents([ev(), b, ev(), ev({ place: 'Town, County' })]);
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('RESI');
    expect(out[1].type).toBe('BIRT');
    expect(out[0].place).toBe('Town, County');
  });
  it('keeps events differing only in value', () => {
    expect(cleanEvents([ev({ value: 'a' }), ev({ value: 'b' })])).toHaveLength(2);
  });
  it('handles missing place and empty input without mutating', () => {
    expect(cleanEvents([])).toEqual([]);
    const input = [ev({ place: undefined }), ev({ place: undefined })];
    const copy = JSON.parse(JSON.stringify(input));
    expect(cleanEvents(input)).toHaveLength(1);
    expect(input).toEqual(copy);
    const withPlace = [ev()];
    cleanEvents(withPlace);
    expect(withPlace[0].place).toBe('Town, County, USA');
  });
});
