import { hrefFor, parseHash } from '../src/lib/route';

describe('parseHash', () => {
  it('gives home for empty hashes', () => {
    for (const h of ['', '#', '#/']) expect(parseHash(h)).toEqual({ name: 'home' });
  });
  it('parses person, tree and surname routes', () => {
    expect(parseHash('#/person/I4')).toEqual({ name: 'person', id: 'I4' });
    expect(parseHash('#/tree/I4')).toEqual({ name: 'tree', id: 'I4' });
    expect(parseHash('#/surname/Bryan')).toEqual({ name: 'surname', surname: 'Bryan' });
  });
  it('decodes percent escapes', () => {
    expect(parseHash('#/surname/O%27Brien')).toEqual({ name: 'surname', surname: "O'Brien" });
  });
  it('gives notfound for unknown or empty-id routes', () => {
    expect(parseHash('#/nonsense')).toEqual({ name: 'notfound' });
    expect(parseHash('#/person/')).toEqual({ name: 'notfound' });
    expect(parseHash('#/surname/%E0%A4%A')).toEqual({ name: 'notfound' });
  });
});

describe('hrefFor', () => {
  it('builds hashes', () => {
    expect(hrefFor({ name: 'home' })).toBe('#/');
    expect(hrefFor({ name: 'person', id: 'I4' })).toBe('#/person/I4');
    expect(hrefFor({ name: 'tree', id: 'I4' })).toBe('#/tree/I4');
    expect(hrefFor({ name: 'surname', surname: "O'Brien" })).toBe("#/surname/O'Brien");
    expect(hrefFor({ name: 'notfound' })).toBe('#/');
  });
  it('round-trips', () => {
    const r = { name: 'surname', surname: "O'Brien Jr" } as const;
    expect(parseHash(hrefFor(r))).toEqual(r);
  });
});
