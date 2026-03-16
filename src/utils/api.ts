import axios from 'axios';
import { useAuthStore } from '../stores/auth';

export function createApiClient() {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  api.interceptors.request.use(function(config) {
    const auth = useAuthStore();
    if (auth.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    return config;
  });

  return api;
}