import { describe, it, expect } from 'vitest';
import indexHtml from '../index.html?raw';
import appSfc from './App.vue?raw';

/** Every file in public/ and src/, by path from this folder (not loaded: only the names are read). */
const files = Object.keys(import.meta.glob(['../public/**/*', './**/*', '!./**/*.test.ts']));

function meta(attribute: 'name' | 'property', key: string): string | undefined {
  return indexHtml.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`))?.[1];
}

describe('page shell', () => {
  it('describes the app for search engines and link previews', () => {
    expect(meta('name', 'description')).toMatch(/^Schedule your Mastodon toots/);
    expect(meta('name', 'theme-color')).toBe('#ffffff');
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:title')).toBe('Toot Scheduler');
    expect(meta('property', 'og:description')).toMatch(/^Schedule your Mastodon toots/);
    expect(meta('property', 'og:url')).toBe('https://www.regulardesigner.com/toots-scheduler/');
  });

  it('keeps no leftover from the Vite template', () => {
    expect(files).not.toContain('../public/vite.svg');
    expect(files).not.toContain('./assets/vue.svg');
    expect(files).not.toContain('./style.css');
    expect(indexHtml).not.toContain('vite.svg');
  });

  it('locks page scroll behind a dialog from the global stylesheet that ships', () => {
    // App.vue's unscoped <style> is the app's global stylesheet; ModalView sets body.modal-open.
    const globalStyle = appSfc.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(globalStyle).toMatch(/body\.modal-open\s*\{\s*overflow:\s*hidden;\s*\}/);
  });
});
