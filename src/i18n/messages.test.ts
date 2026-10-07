import { describe, expect, it } from 'vitest';
import { de, en, format } from './messages';

describe('messages', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(format('{count} places for {query}', { count: 3, query: 'Berlin' })).toBe(
      '3 places for Berlin',
    );
    expect(format('Hello {name}')).toBe('Hello {name}');
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key]), key).toBe(placeholders(en[key]));
    }
  });
});
