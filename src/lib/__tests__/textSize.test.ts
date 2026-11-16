/**
 * Text-size setting: stored under myhrms:textSize, applied as the root font
 * size (and as <html data-text-size> for layout rules), and safe when
 * localStorage is missing or throws.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installLocalStorage } from './storageStub';
import { TEXT_SIZE_KEY, getTextSize, initTextSize, setTextSize } from '../textSize';

describe('textSize', () => {
  const realDocument = globalThis.document;
  let style: { fontSize: string };
  let dataset: { textSize?: string };

  beforeEach(() => {
    installLocalStorage();
    style = { fontSize: '' };
    dataset = {};
    Object.defineProperty(globalThis, 'document', {
      value: { documentElement: { style, dataset } },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true, writable: true });
  });

  it('defaults to normal (18px)', () => {
    expect(initTextSize()).toBe('normal');
    expect(style.fontSize).toBe('18px');
  });

  it('saves and applies big (21px) and bigger (24px)', () => {
    setTextSize('big');
    expect(localStorage.getItem(TEXT_SIZE_KEY)).toBe('big');
    expect(style.fontSize).toBe('21px');
    setTextSize('bigger');
    expect(getTextSize()).toBe('bigger');
    expect(style.fontSize).toBe('24px');
    expect(dataset.textSize).toBe('bigger');
  });

  it('restores the saved choice on start', () => {
    localStorage.setItem(TEXT_SIZE_KEY, 'bigger');
    expect(initTextSize()).toBe('bigger');
    expect(style.fontSize).toBe('24px');
  });

  it('falls back to normal for an unknown stored value', () => {
    localStorage.setItem(TEXT_SIZE_KEY, 'huge');
    expect(getTextSize()).toBe('normal');
  });

  it('still works when localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
      },
      configurable: true,
      writable: true,
    });
    expect(getTextSize()).toBe('normal');
    expect(() => setTextSize('big')).not.toThrow();
    expect(style.fontSize).toBe('21px');
  });
});
