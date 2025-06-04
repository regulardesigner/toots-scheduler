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

- Node.js (v20 or later recommended)
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
npm install
```

3. Copy the environment file and configure it:
```bash
cp .env.example .env
```

4. Update the `.env` file with your Mastodon instance details:
```env
VITE_MASTODON_SERVER=https://mastodon.social
```

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
- `env.example`: Example environment configuration file

## Development Workflow

1. **Fork and Clone**: Fork the repository and clone it to your local machine.
2. **Install Dependencies**: Run `npm install` to install all required dependencies.
3. **Configure Environment**: Copy `.env.example` to `.env` and update with your Mastodon instance details.
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
