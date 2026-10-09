/// <reference types="node" />
/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
/**
 * Content Security Policy for the production build. GitHub Pages can't send headers, so it
 * is a <meta> tag (which ignores frame-ancestors). Only scripts and styles from this origin may load;
 * the instance is reached over https (connect-src) and serves images and media over https.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Adds the CSP to index.html at build time only: the dev server needs inline scripts and websockets. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue(), contentSecurityPolicy()],
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
    // The global stylesheets are read as text by their tests (`?raw`); other CSS stays skipped.
    css: { include: [/\/assets\/styles\/.+\.css/] },
  },
}))
