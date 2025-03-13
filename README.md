# Toots Scheduler 📅 ⏰

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with [Vue.js](https://vuejs.org/)
- Powered by [Mastodon API](https://docs.joinmastodon.org/api/)
