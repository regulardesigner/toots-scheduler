/// <reference types="node" />
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: '/toots-scheduler/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    // Never ship console output (API responses, account data) to production users.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
}))
