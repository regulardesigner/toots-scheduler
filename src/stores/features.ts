import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { z } from 'zod';
import type { FeatureGroup, UserFeatureState } from '../types/features';
import { logError } from '../utils/logError';

const STORAGE_KEY = 'masto-publish-later-features';

/** What's New shows at most this many unseen releases, newest first. */
const MAX_RECENT_RELEASES = 3;

/** The saved state; a wrong field falls back to its empty value. */
const UserFeatureStateSchema = z.object({
  lastSeenVersion: z.string().catch(''),
  seenFeatures: z.array(z.string()).catch([]),
});

/**
 * Reads what the user has already seen. A missing, corrupt or foreign value gives a fresh
 * state: a bad value in localStorage must never break the app at startup.
 * @returns {UserFeatureState} The saved state, or an empty one.
 */
function readSavedState(): UserFeatureState {
  const empty: UserFeatureState = { lastSeenVersion: '', seenFeatures: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return empty;
    const parsed = UserFeatureStateSchema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : empty;
  } catch {
    return empty;
  }
}

/**
 * Creates a Pinia store for the "What's New" release notes and what the user has seen of them.
 * @returns {Object} `features`, `newFeatures` and `markFeaturesAsSeen`.
 */
export const useFeaturesStore = defineStore('features', () => {
  /** Every release, newest first: the changelog (append-only, see the changelog skill). */
  const features = ref<FeatureGroup[]>([
    {
      version: '0.16.0',
      date: '2026-10-06',
      features: [
        {
          id: 'instance-limits',
          title: '📏 Your Instance, Your Limits',
          description: 'The composer now follows your instance\'s own limits: toot length, number of images, image size and image types. Links count as 23 characters and emoji as one, just like on Mastodon, and older servers are supported too.'
        },
        {
          id: 'keyboard-and-screen-readers',
          title: '♿ Better With a Keyboard and a Screen Reader',
          description: 'Dialogs, the mobile menu and the composer now work fully with the keyboard: Escape closes them and focus goes back where you were. Screen readers hear errors right away, and a warning as you get close to the character limit.'
        },
        {
          id: 'time-zone-shown',
          title: '🕒 Time Zone Shown',
          description: 'The time zone your toots are scheduled in is now shown under the date and time fields and on every scheduled toot.'
        },
        {
          id: 'per-toot-progress',
          title: '🐛 Fix: The Right Toot, Every Time',
          description: 'Revealing a toot behind a content warning no longer reveals another one, and progress only shows on the toot concerned. Changes now run one at a time, and you are told if the toot you were editing gets deleted.'
        },
      ],
    },
    {
      version: '0.15.0',
      date: '2026-10-04',
      features: [
        {
          id: 'confirm-thanks',
          title: '💌 Say Thanks, With a Preview',
          description: 'Say Thanks now shows you the exact message before it is sent, and tells you if it could not be delivered.'
        },
        {
          id: 'safer-uploads',
          title: '🖼️ Clearer Image Uploads',
          description: 'Files that are not supported images, or are larger than 8 MB, are refused right away with a clear message, and dropping several images at once keeps all of them.'
        },
        {
          id: 'stricter-security',
          title: '🛡️ Stricter Security',
          description: 'The app now only runs its own code and checks everything your instance sends back before using it.'
        },
      ],
    },
    {
      version: '0.14.0',
      date: '2026-10-02',
      features: [
        {
          id: 'safer-sign-in',
          title: '🔐 Safer Sign-In',
          description: 'Signing in now uses extra protections against forged sign-in links, and only secure (https) instances are accepted. You can simply type your instance name, like mastodon.social.'
        },
        {
          id: 'real-session-expiry',
          title: '⏳ Sessions Really Expire',
          description: 'After 30 minutes without activity you are signed out and your access is revoked on your instance. If you closed the tab, this happens the next time you open the app.'
        },
        {
          id: 'logout-everywhere',
          title: '🚪 Log Out of Every Tab at Once',
          description: 'Logging out revokes the app\'s access on your instance and signs you out in every open tab of this browser.'
        },
      ],
    },
    {
      version: '0.13.2',
      date: '2026-10-02',
      features: [
        {
          id: 'safe-toot-editing',
          title: '🐛 Fix: Editing Never Loses a Toot',
          description: 'Editing a scheduled toot now creates the new version before removing the old one, and a simple date change is applied in place. If something goes wrong, your original toot stays safe. If the toot was already published, you\'re told instead of getting a duplicate.'
        },
        {
          id: 'no-duplicate-toots',
          title: '🐛 Fix: No More Duplicate Toots',
          description: 'Clicking Schedule twice, or retrying after a network hiccup, no longer creates the same toot twice.'
        },
        {
          id: 'all-scheduled-toots-listed',
          title: '🐛 Fix: All Your Scheduled Toots Are Listed',
          description: 'If you have more than 20 scheduled toots, you now see all of them instead of only the first 20.'
        },
        {
          id: 'poll-and-language-fixes',
          title: '🐛 Fix: Polls and Languages When Editing',
          description: 'A poll you closed is no longer sent by mistake, and editing a toot keeps its original language.'
        },
      ],
    },
    {
      version: '0.13.1',
      date: '2026-10-01',
      features: [
        {
          id: 'security-dependency-update',
          title: '🔒 Security Updates',
          description: 'We updated the libraries Toot Scheduler relies on to close known security issues, and every new release is now automatically checked before it goes live.'
        },
      ],
    },
    {
      version: '0.13.0',
      date: '2026-03-25',
      features: [
        {
          id: 'delete-confirmation-modal',
          title: '🗑️ Nicer Delete Confirmation',
          description: 'Deleting a scheduled toot now shows a clean in-app confirmation dialog instead of the browser\'s default popup. The experience is smoother and matches the rest of the app.'
        },
      ],
    },
    {
      version: '0.12.19',
      date: '2026-03-16',
      features: [
        {
          id: 'fix-auth-token-timeout',
          title: '🔐 Auth: token validation & timeout fixes',
          description: 'Fixed token validation issues and axios timeout during authentication. Your sessions are now rock solid! 💪'
        },
        {
          id: 'fix-auth-callback-form',
          title: '🚪 Auth: callback & login error display',
          description: 'Fixed the callback error redirect and improved how login errors are displayed. No more confusion when something goes wrong! 🎯'
        },
      ],
    },
    {
      version: '0.12.18',
      date: '2026-03-15',
      features: [
        {
          id: 'fix-wrong-import-url',
          title: '🐛 Fix: wrong import url',
          description: 'Fixed a wrong import URL that was causing loading issues. Everything\'s back on track! 🛤️'
        },
      ],
    },
    {
      version: '0.12.17',
      date: '2025-04-16',
      features: [
        {
          id: 'tootsheduler-poll',
          title: '🗳️ Add a poll to your toot ✨',
          description: 'We are thrilled to announce a new feature that will transform the way you interact on Toot Scheduler! Now you can easily add a poll to your scheduled toots. Let\'s Poll Up!'
        },
      ],
    },
    {
      version: '0.11.17',
      date: '2025-04-09',
      features: [
        {
          id: 'tootsheduler-hashtag-removal',
          title: '🔖 Hashtag #TootScheduler removal',
          description: 'The #TootScheduler hashtag has been removed from scheduled toots. No more unwanted hashtags!'
        },
        {
          id: 'name-tootsheduler',
          title: '🧠 Toots Scheduler is now Toot Scheduler',
          description: 'Corrected a small typo in the app name. The double "s" was annoying, especially for dyslexic users.'
        },
      ],
    },
    {
      version: '0.10.16',
      date: '2025-04-02',
      features: [
        {
          id: 'upload-media-image',
          title: '🖼️ Upload media image',
          description: 'You can now upload images to your scheduled toots!'
        },
      ],
    },
    {
      version: '0.9.15',
      date: '2025-03-29',
      features: [
        {
          id: 'show-sensitive-content',
          title: '👁️ Show/Hide sensitive content in Scheduled Toots',
          description: 'You can now see if a scheduled toot has sensitive content!'
        },
        {
          id: 'fix-spoiler-text',
          title: '🐛 Fix spoiler text',
          description: 'Fixed an issue where spoiler text wasn\'t correctly retrieved when updating a scheduled toot.'
        },
      ],
    },
    {
      version: '0.8.13',
      date: '2025-03-28',
      features: [
        {
          id: 'direct-thanks-you',
          title: '🤗 Direct thanks you message',
          description: 'You can now directly send a thank you message via Mastodon!'
        },
      ],
    },
    {
      version: '0.7.12',
      date: '2025-03-25',
      features: [
        {
          id: 'toots-asc-ordering',
          title: '🚸 Toots list ordering',
          description: 'The scheduled toots list is now ordered by ascending scheduled date.'
        },
        {
          id: 'routing-to-home',
          title: '🚚 Better auth routing',
          description: 'The app will now route you to the home page if you are not authenticated.'
        },
        {
          id: 'layout-ui-fix',
          title: '💄 Layout & UI fixes',
          description: 'Fixed some minor layout and UI issues.'
        },
      ],
    },
    {
      version: '0.7.9',
      date: '2025-03-24',
      features: [
        {
          id: 'New Landing & new design',
          title: '💄 Landing & design',
          description: 'Added a proper landing page with clear information and an incredible design!'
        },
      ],
    },
    {
      version: '0.6.9',
      date: '2024-03-19',
      features: [
        {
          id: 'edit-scheduled-toots',
          title: '🔄 Edit scheduled toots',
          description: 'You can now edit your scheduled toots!'
        },
        {
          id: 'edit-mode-scroll-to-textarea',
          title: '🚡 Edit mode scroll to textarea',
          description: 'When you click on the Edit button, we scroll you straight to the textarea!'
        },
      ],
    },
    {
      version: '0.5.8',
      date: '2024-03-19',
      features: [
        {
          id: 'header-layout-fix',
          title: '📱 Header layout fix',
          description: 'The header layout is now more responsive on mobile devices.'
        },
      ],
    },
    {
      version: '0.5.7',
      date: '2024-03-18',
      features: [
        {
          id: 'whats-new',
          title: '👋 Say hello to What\'s new?',
          description: 'You can now discover the latest features and updates in the app!'
        },
        {
          id: 'bugs-fixes-0.5.7',
          title: '🐛 Bugs fixes',
          description: 'Improved the app and fixed some bugs.'
        },
      ],
    },
    {
      version: '0.4.4',
      date: '2024-03-16',
      features: [
        {
          id: 'timout-session',
          title: '🏴‍☠️ Auto logout session',
          description: 'For safety, you will be automatically logged out if you leave the page open for too long.'
        },
      ],
    },
    {
      version: '0.3.4',
      date: '2024-03-14',
      features: [
        {
          id: 'minimun-scheduling-time',
          title: '🐘 Minimum toot scheduling time & Bugs fixes',
          description: 'Implemented a minimum 5-minute scheduling time for toots, as required by Mastodon.'
        },
        {
          id: 'bugs-fixes-0.3.4',
          title: '🐛 Bugs fixes',
          description: 'Fixed some bugs.'
        },
      ],
    },
    {
      version: '0.2.2',
      date: '2024-03-13',
      features: [
        {
          id: 'hashtag-tootsSheduler',
          title: '🔖 Hashtag TootScheduler',
          description: 'All scheduled toots are now tagged with #TootScheduler!'
        },
      ],
    },
    {
      version: '0.1.2',
      date: '2024-03-12',
      features: [
        {
          id: 'schedule-posts',
          title: '🕒 Schedule Posts',
          description: 'Welcome to Toot Scheduler! You can now schedule your posts to be published at a specific time.'
        },
        {
          id: 'bugs-fixes-0.1.2',
          title: '🐛 Bugs fixes',
          description: 'Fixed some bugs.'
        },
      ],
    },
  ]);

  /** The newest release; written as the last version seen. */
  const latestVersion = computed(() => features.value[0]?.version ?? '');

  /** What the user has already seen, read once at startup. */
  const userState = ref<UserFeatureState>(readSavedState());

  /** Remembers what was seen. The browser may refuse (storage full or disabled): What's New still closes. */
  function saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState.value));
    } catch (error) {
      logError('Could not save the seen releases', error);
    }
  }

  /** Releases the user has not seen yet, newest first. */
  const unseenFeatures = computed(() =>
    features.value.filter(group => !userState.value.seenFeatures.includes(group.version)),
  );

  /** The few most recent unseen releases: what the What's New dialog shows. */
  const recentNewFeatures = computed(() => unseenFeatures.value.slice(0, MAX_RECENT_RELEASES));

  /** Marks every release as seen, and saves it. */
  function markFeaturesAsSeen(): void {
    userState.value.seenFeatures = features.value.map(group => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  return {
    features,
    newFeatures: recentNewFeatures,
    markFeaturesAsSeen,
  };
});
