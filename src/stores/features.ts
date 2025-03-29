import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FeatureGroup, UserFeatureState } from '../types/features';

const STORAGE_KEY = 'masto-publish-later-features';

export const useFeaturesStore = defineStore('features', () => {
  const features = ref<FeatureGroup[]>([
    {
      version: '0.9.15',
      date: '2025-03-29',
      features: [
        {
          id: 'show-sensitive-content',
          title: '👁️ Show/Hide sensitive content in Scheduled Toots',
          description: 'Now you can see if a scheduled toot has sensitive content!',
        },
        {
          id: 'fix-spoiler-text',
          title: '🐛 Fix spoiler text',
          description: 'The spoiler text wasn\'t correctly retrieved when updating a scheduled toot…',
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
          description: 'Now you can directly send me a direct message to say thanks on mastodon!',
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
          description: 'Now the sheduled toots list is ordered by ascending scheduled date!',
        },
        {
          id: 'routing-to-home',
          title: '🚚 Better auth routing',  
          description: 'Now the app will route you to the home page if you are not authenticated!',
        },
        {
          id: 'layout-ui-fix',
          title: '💄 Layout & UI fixes',  
          description: 'Fixed some minor layouts and UI issues!',
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
          description: 'Let\'s face it we needed a proper landing page with clear arguments and a incredible design!',
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
          description: 'Made a typo? No problem! Now you can edit your scheduled toots!',
        },
        {
          id: 'edit-mode-scroll-to-textarea',
          title: '🚡 Edit mode scroll to textarea',
          description: 'When you click on the Edit button, we "scroll" you straight to the textarea!',
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
          description: 'Fixed the header layout to be more responsive on mobile devices!',
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
          description: 'Now you can discover (here) the latest features and updates in the app!',
        },
        {
          id: 'bugs-fixes-0.5.7',
          title: '🐛 Bugs fixes',
          description: 'Yep, I\'ve improved the app and fixed some bugs!',
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
          description: 'Safety first! If you leave the page open for too long, you will be logged out automatically.',
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
          description: 'Mastodon doesn\'t allow you to plan a toot less than 5 minutes later, so I\'ve made sure that\'s no longer possible.',
        },
        {
          id: 'bugs-fixes-0.3.4',
          title: '🐛 Bugs fixes',
          description: 'I\'ve fixed some bugs.',
        },
      ],
    },
    {
      version: '0.2.2',
      date: '2024-03-13',
      features: [
        {
          id: 'hashtag-tootsSheduler',
          title: '🔖 Hashtag Toots Scheduler',
          description: 'Let\'s spread the word! Now all scheduled toots will be tagged with #TootScheduler!',
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
          description: 'Welcome to Toots Scheduler! You can schedule your posts to be published at a specific time!',
        },
        {
          id: 'bugs-fixes-0.1.2',
          title: '🐛 Bugs fixes',
          description: 'I\'ve fixed some bugs.',
        },
      ],
    },
  ]);

  // Get the latest version from features
  const latestVersion = computed(() => {
    return features.value[0]?.version || '1.0.0';
  });

  const userState = ref<UserFeatureState>({
    lastSeenVersion: '',
    seenFeatures: [],
  });

  // Load state from localStorage
  function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      userState.value = JSON.parse(savedState);
    }
  }

  // Save state to localStorage
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userState.value));
  }

  // Get new features that haven't been seen
  const newFeatures = computed(() => {
    return features.value.filter(
      (group: FeatureGroup) => !userState.value.seenFeatures.includes(group.version)
    );
  });

  // Get last 3 new features
  const lastThreeNewFeatures = computed(() => {
    return newFeatures.value.slice(0, 3);
  });

  // Mark features as seen
  function markFeaturesAsSeen() {
    userState.value.seenFeatures = features.value.map((group: FeatureGroup) => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  // Initialize store
  loadState();

  return {
    features,
    newFeatures: lastThreeNewFeatures,
    markFeaturesAsSeen,
  };
}); 