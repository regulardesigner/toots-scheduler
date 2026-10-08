import { describe, it, expect } from 'vitest';
import toastsCss from './toasts.css?raw';

/** WCAG relative luminance of a #rgb or #rrggbb colour. */
function luminance(hex: string): number {
  const value = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `color` drawn at `opacity` over `background`, as the browser composites it. */
function blend(color: string, background: string, opacity: number): string {
  const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [fg, bg] = [channels(color), channels(background)];
  return '#' + fg.map((c, i) => Math.round(c * opacity + bg[i] * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}

/** Long form (#333 → #333333), lower case. */
function normalize(hex: string): string {
  const value = hex.toLowerCase();
  return value.length === 4 ? '#' + value.slice(1).split('').map(c => c + c).join('') : value;
}

/** The colours set for one toast type, read from toasts.css. */
function colorsOf(type: string): { background: string; text: string } {
  const rule = toastsCss.match(new RegExp(`\\.Vue-Toastification__toast--${type}[^{]*\\{([^}]*)\\}`));
  if (!rule) throw new Error(`No rule for ${type} toasts`);
  const background = rule[1].match(/background-color:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
  const text = rule[1].match(/(?:^|[\s;])color:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
  if (!background || !text) throw new Error(`Incomplete colours for ${type} toasts`);
  return { background: normalize(background), text: normalize(text) };
}

const TYPES = ['default', 'success', 'info', 'warning', 'error'];

describe('toast colours', () => {
  it.each(TYPES)('gives %s toasts text with at least 4.5:1 contrast', (type) => {
    const { background, text } = colorsOf(type);

    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the close button (24px bold, large text) at 3:1 or more on every toast', () => {
    const opacity = Number(toastsCss.match(/__close-button\s*\{[^}]*opacity:\s*([\d.]+)/)?.[1]);
    expect(opacity).toBeGreaterThan(0);

    for (const type of TYPES) {
      const { background, text } = colorsOf(type);
      expect(contrast(blend(text, background, opacity), background)).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses only colours from the design system palette', () => {
    const palette = ['#333333', '#ffffff', '#2577b1', '#ff9200', '#c0392b'];
    const rules = toastsCss.replace(/\/\*[\s\S]*?\*\//g, ''); // comments name the library's old colours
    const used = [...rules.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map(match => normalize(match[0]));

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(color => !palette.includes(color))).toEqual([]);
  });
});
