/** Home greeting name: employee name first, readable username as fallback. */
import { describe, expect, it } from 'vitest';
import { greetingName } from '../lib';

describe('greetingName', () => {
  it('uses the linked employee name', () => {
    expect(greetingName('Siti Mariam binti Abdullah', 'siti5')).toBe('Siti Mariam binti Abdullah');
  });
  it('falls back to the capitalised username', () => {
    expect(greetingName(undefined, 'admin')).toBe('Admin');
    expect(greetingName('', 'hr')).toBe('Hr');
    expect(greetingName(undefined, 'jane.doe')).toBe('Jane Doe');
    expect(greetingName(undefined, undefined)).toBe('');
  });
});
