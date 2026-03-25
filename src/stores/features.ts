import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FeatureGroup, UserFeatureState } from '../types/features';

const STORAGE_KEY = 'masto-publish-later-features';

/**
 * Creates a Pinia store for managing app features.
 * @returns {Object} The features store with state and actions.
 */
export const useFeaturesStore = defineStore('features', () => {
  const features = ref<FeatureGroup[]>([
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

  // Get the latest version from features
  /**
   * Computes the latest version from the features list.
   * @returns {string} The latest version number.
   */
  const latestVersion = computed(() => {
    return features.value[0]?.version || '1.0.0';
  });

  const userState = ref<UserFeatureState>({
    lastSeenVersion: '',
    seenFeatures: [],
  });

  // Load state from localStorage
  /**
   * Loads the user's feature state from localStorage.
   */
  function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      userState.value = JSON.parse(savedState);
    }
  }

  // Save state to localStorage
  /**
   * Saves the user's feature state to localStorage.
   */
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userState.value));
  }

  // Get new features that haven't been seen
  /**
   * Computes the list of new features that haven't been seen by the user.
   * @returns {Array} The list of new feature groups.
   */
  const newFeatures = computed(() => {
    return features.value.filter(
      (group: FeatureGroup) => !userState.value.seenFeatures.includes(group.version)
    );
  });

  // Get last 3 new features
  /**
   * Computes the last three new features.
   * @returns {Array} The last three new feature groups.
   */
  const lastThreeNewFeatures = computed(() => {
    return newFeatures.value.slice(0, 3);
  });

  // Mark features as seen
  /**
   * Marks all features as seen and updates the user's state.
   */
  function markFeaturesAsSeen() {
    userState.value.seenFeatures = features.value.map((group: FeatureGroup) => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  // Initialize store
  loadState();

  return {
    /**
     * The list of feature groups.
     * @type {Ref<FeatureGroup[]>}
     */
    features,
  
    /**
     * The last three new features that haven't been seen by the user.
     * @type {ComputedRef<Array>}
     */
    newFeatures: lastThreeNewFeatures,
  
    /**
     * Marks all features as seen.
     */
    markFeaturesAsSeen,
  };
}); 