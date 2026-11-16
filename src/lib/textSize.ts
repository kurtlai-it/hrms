/**
 * Text-size setting (Me panel: Normal / Big / Bigger). Sets the root font
 * size; everything sized in rem scales with it. Remembered per browser.
 */

export type TextSize = 'normal' | 'big' | 'bigger';

export const TEXT_SIZE_KEY = 'myhrms:textSize';

export const TEXT_SIZE_PX: Record<TextSize, number> = {
  normal: 18,
  big: 21,
  bigger: 24,
};

function isTextSize(v: unknown): v is TextSize {
  return v === 'normal' || v === 'big' || v === 'bigger';
}

/** Saved choice, or 'normal' when nothing (or something invalid) is stored. */
export function getTextSize(): TextSize {
  try {
    const v = localStorage.getItem(TEXT_SIZE_KEY);
    return isTextSize(v) ? v : 'normal';
  } catch {
    return 'normal';
  }
}

/** Set the root font size on <html> without saving. */
export function applyTextSize(size: TextSize): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${TEXT_SIZE_PX[size]}px`;
  document.documentElement.dataset.textSize = size;
}

/** Save the choice and apply it. */
export function setTextSize(size: TextSize): void {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {
    /* ignore — still apply for this session */
  }
  applyTextSize(size);
}

/** Apply the saved choice; call once on app start. */
export function initTextSize(): TextSize {
  const size = getTextSize();
  applyTextSize(size);
  return size;
}
