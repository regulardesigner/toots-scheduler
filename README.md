# Toot Scheduler 📅 ⏰

[![Deploy to GitHub Pages](https://github.com/regulardesigner/toots-scheduler/actions/workflows/deploy.yml/badge.svg)](https://github.com/regulardesigner/toots-scheduler/actions/workflows/deploy.yml)

A modern Vue.js application that allows you to schedule Mastodon posts (toots) for later publication. Built with Vue 3, TypeScript, and Vite.

## Features

- 🔐 Secure OAuth authentication with Mastodon
- 📝 Compose toots with content warnings
- ⏰ Schedule toots for future publication
- 🌍 Multi-language support
- 🔒 Privacy settings (public, unlisted, private, direct)
- 📱 Responsive design
- 🎯 Real-time validation
- 📊 View and manage scheduled toots

## Tech Stack

- Vue 3 with Composition API
- TypeScript
- Vite
- Pinia for state management
- Vue Router
- date-fns for date handling

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`; run `nvm use`)
- npm (included with Node.js)
- A Mastodon account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/toots-scheduler.git
cd toots-scheduler
```

2. Install dependencies:
```bash
npm ci
```

No environment file is needed: the app registers itself on the Mastodon instance you sign in to.

### Development

Start the development server:
```bash
npm run dev
```

### Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

### Quality checks

These run in CI on every pull request and must pass before deploy:
```bash
npm run lint        # ESLint (v-html forbidden)
npm run typecheck   # vue-tsc -b
npm test            # Vitest
npm audit --omit=dev --audit-level=high
```

## Security

Toot Scheduler is a static site with no backend. Here is what it does to protect your account:

- **Sign-in:** OAuth 2.0 with a random `state`, which blocks forged sign-in links, plus PKCE (S256) on instances running Mastodon 4.3 or later. Older instances ignore PKCE and rely on `state` alone. Only HTTPS instances are accepted, and the app asks only for the scopes it needs (`read:accounts read:statuses write:media write:statuses`).
- **What is stored, and where:** your access token and the app's own client registration on your instance (client id and secret, not your password) sit in this browser's `localStorage`, under a single `mastodon_auth` key. No server stores your token or your toots; everything stays on your instance.
- **Session end:**
  - After 30 minutes without activity you are signed out, and the token is revoked on your instance (`POST /oauth/revoke`). If you closed the tab, this happens the next time you open the app.
  - Logging out revokes the token and signs out every open tab of this browser.
  - If your instance rejects the token, the session ends too.
  - Revocation is best effort: if you are offline or the instance is down, revoke the app yourself under *Preferences → Account → Authorized apps*.
- **Upgrading to 0.14.0:** sessions saved by older versions are signed out once, and their token is revoked.
- **Content Security Policy:** the production page only loads scripts and styles from its own origin (no inline or injected script, no plugins), talks to instances over https only, and loads images and media over https. GitHub Pages can't send headers, so the policy is a `<meta>` tag: clickjacking protection (`frame-ancestors`) isn't available, and "its own origin" is `regulardesigner.github.io`, which is shared with the account's other GitHub Pages sites (a custom domain would isolate the app).
- **Known trade-off:** while you are signed in, a script running on this page could read the token. That is the price of having no backend; the CSP above makes injecting one much harder. The app never renders HTML coming from the API (`v-html` is forbidden by the linter), checks every response from the instance before using it, and the production build contains no console output.

## Project Structure

The project follows a standard Vue.js project structure with the following key directories:

- `src/`: Contains all the source code for the application
  - `assets/`: Static assets like images and fonts
  - `components/`: Vue components used throughout the application
  - `composables/`: Composition API utilities
  - `router/`: Vue Router configuration
  - `stores/`: Pinia stores for state management
  - `types/`: TypeScript type definitions
  - `utils/`: Utility functions and helpers
- `public/`: Static files that are served as-is

## Development Workflow

1. **Fork and Clone**: Fork the repository and clone it to your local machine.
2. **Install Dependencies**: Run `npm ci` to install the locked dependencies.
3. **Run Quality Checks**: `npm run lint && npm run typecheck && npm test` before pushing.
4. **Run Development Server**: Use `npm run dev` to start the development server.
5. **Make Changes**: Implement your changes in the appropriate files.
6. **Test Changes**: Test your changes thoroughly to ensure they work as expected.
7. **Commit Changes**: Commit your changes with clear, descriptive commit messages.
8. **Create Pull Request**: Push your changes to your fork and create a pull request to the main repository.

## Coding Standards

- Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) for JavaScript/TypeScript code.
- Use [Prettier](https://prettier.io/) for code formatting.
- Write clear, descriptive commit messages.
- Include appropriate comments in your code to explain complex logic.
- Keep functions small and focused on a single responsibility.

## Contribution Guidelines

We welcome contributions from the community! Here are some guidelines to follow:

1. **Fork the Repository**: Start by forking the repository to your GitHub account.
2. **Create a Branch**: Create a new branch for your feature or bug fix.
3. **Make Changes**: Implement your changes following the coding standards.
4. **Write Tests**: If applicable, write tests for your changes.
5. **Update Documentation**: Update the README or other documentation as needed.
6. **Submit a Pull Request**: Push your changes and create a pull request to the main repository.
7. **Code Review**: Your pull request will be reviewed by maintainers. Be prepared to make changes based on feedback.
8. **Merge**: Once approved, your changes will be merged into the main branch.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Vue.js](https://vuejs.org/)
- Powered by [Mastodon API](https://docs.joinmastodon.org/api/)
