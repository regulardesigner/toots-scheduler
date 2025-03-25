import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import TootComposer from '../components/TootComposer.vue';
import LandingPage from '../components/LandingPage.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingPage,
    },
    {
      path: '/composer',
      name: 'composer',
      component: TootComposer,
      meta: { requiresAuth: true },
    },
    {
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: () => import('../components/OAuthCallback.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' }
    }
  ],
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  
  // If trying to access composer without auth, redirect to home
  if (to.meta.requiresAuth && !auth.accessToken) {
    next({ name: 'home' });
  } 
  // If authenticated and trying to access home, redirect to composer
  else if (to.name === 'home' && auth.accessToken) {
    next({ name: 'composer' });
  } 
  else {
    next();
  }
});

export default router; 