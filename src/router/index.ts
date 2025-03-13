import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginForm from '../components/LoginForm.vue';
import TootComposer from '../components/TootComposer.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: TootComposer,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginForm,
    },
    {
      path: '/oauth/callback',
      name: 'oauth-callback',
      component: () => import('../components/OAuthCallback.vue'),
    },
  ],
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  
  if (to.meta.requiresAuth && !auth.accessToken) {
    next({ name: 'login' });
  } else if (to.name === 'login' && auth.accessToken) {
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router; 