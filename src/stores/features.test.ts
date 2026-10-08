import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFeaturesStore } from './features';
import packageJson from '../../package.json';

const STORAGE_KEY = 'masto-publish-later-features';

/** Versions, newest first, as listed by the store. */
const versionsOf = (groups: { version: string }[]) => groups.map(group => group.version);

describe('features store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows at most the three most recent releases, newest first, to a new user', () => {
    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(0, 3)));
  });

  it('leaves out the releases already seen', () => {
    const latest = useFeaturesStore().features[0].version;
    setActivePinia(createPinia());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastSeenVersion: latest, seenFeatures: [latest] }));

    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(1, 4)));
  });

  it.each([
    ['not JSON', '{not json'],
    ['not an object', '"0.16.0"'],
    ['a list of the wrong type', '{"lastSeenVersion":"0.16.0","seenFeatures":"0.16.0"}'],
    ['null', 'null'],
  ])('starts afresh when the saved state is %s, instead of breaking the app', (_label, saved) => {
    localStorage.setItem(STORAGE_KEY, saved);

    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(0, 3)));
  });

  it('marks every release as seen, and remembers it', () => {
    const store = useFeaturesStore();

    store.markFeaturesAsSeen();

    expect(store.newFeatures).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      lastSeenVersion: store.features[0].version,
      seenFeatures: versionsOf(store.features),
    });
  });

  it('still closes What\'s New when the browser refuses to save', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const store = useFeaturesStore();

    expect(() => store.markFeaturesAsSeen()).not.toThrow();
    expect(store.newFeatures).toEqual([]);
  });

  it('keeps the changelog consistent: the newest release is the package version, ids and versions are unique', () => {
    const { features } = useFeaturesStore();
    const ids = features.flatMap(group => group.features.map(feature => feature.id));

    expect(features[0].version).toBe(packageJson.version);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(versionsOf(features)).size).toBe(features.length);
  });
});
