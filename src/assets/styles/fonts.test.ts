import { describe, it, expect } from 'vitest';
import fontsCss from './fonts.css?raw';

/** Every file under src/assets/fonts, by path (not loaded: only the names are read). */
const fontFiles = Object.keys(import.meta.glob('../fonts/**/*'));

describe('fonts', () => {
  it('loads only WOFF2 files, one per family', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);

    expect(urls).toEqual([
      '../fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2',
      '../fonts/Winky_Sans/WinkySans-Variable-Latin.woff2',
    ]);
    expect(fontsCss).not.toMatch(/truetype/);
    expect([...fontsCss.matchAll(/format\('([^']+)'\)/g)].map(match => match[1])).toEqual(['woff2', 'woff2']);
  });

  it('declares the variable weight ranges and swap', () => {
    const faces = [...fontsCss.matchAll(/@font-face\s*{([^}]*)}/g)].map(m => m[1]);
    expect(faces).toHaveLength(2);
    expect(faces[0]).toMatch(/font-weight:\s*200 1000;/);
    expect(faces[1]).toMatch(/font-weight:\s*300 900;/);
    for (const face of faces) expect(face).toMatch(/font-display:\s*swap;/);
  });

  it('points at files that exist', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);

    for (const url of urls) expect(fontFiles).toContain(url);
  });

  it('keeps no TrueType, OpenType or WOFF 1 file in the repository', () => {
    expect(fontFiles.filter(path => /\.(ttf|otf|woff)$/i.test(path))).toEqual([]);
  });

  it('keeps the licence next to each font', () => {
    expect(fontFiles).toContain('../fonts/Nunito_Sans/OFL.txt');
    expect(fontFiles).toContain('../fonts/Winky_Sans/OFL.txt');
  });
});
