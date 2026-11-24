import { describe, it, expect } from 'vitest';
import { bucketOf, shardKey, BUCKET_COUNT } from '../src/shared/keys';

describe('bucketOf', () => {
  it('uses numeric part mod bucket count', () => {
    expect(BUCKET_COUNT).toBe(200);
    expect(bucketOf('I4')).toBe(4);
    expect(bucketOf('I200')).toBe(0);
    expect(bucketOf('F12510')).toBe(110);
  });
});

describe('shardKey', () => {
  it('normalises to two a-z letters', () => {
    expect(shardKey("O'Brien")).toBe('ob');
    expect(shardKey('Éa')).toBe('ea');
    expect(shardKey('')).toBe('__');
    expect(shardKey('X')).toBe('x_');
  });
});
