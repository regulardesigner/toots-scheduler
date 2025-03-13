# Toots Scheduler

A Vue 3 + TypeScript application that allows you to schedule posts (toots) on Mastodon. Built with the Composition API and modern best practices.

## Features

- OAuth authentication with Mastodon instances
- Schedule toots for future publication
- Support for media attachments (images and videos)
- Visibility control (public, unlisted, private, direct)
- Character count tracking
- Responsive design
- Secure logout with automatic redirection

## Tech Stack

- Vue 3 with Composition API
- TypeScript
- Vite
- Pinia for state management
- Vue Router
- Axios for API calls
- date-fns for date manipulation

## Project Structure

```
src/
├── components/         # Vue components
├── composables/        # Reusable composition functions
├── router/            # Vue Router configuration
├── stores/            # Pinia stores
└── types/             # TypeScript type definitions
```

## Components

### `App.vue`
The root component that provides the basic layout and handles authentication state.
- Props: None
- Events: None
- Key features:
  - Basic layout structure
  - Authentication-aware navigation
  - Async logout handling with redirection

### `LoginForm.vue`
Handles the initial connection to a Mastodon instance and OAuth flow.
- Props: None
- Events: None
- Key features:
  - Instance URL validation
  - OAuth application registration
  - Error handling and loading states

### `OAuthCallback.vue`
Processes the OAuth callback and token exchange.
- Props: None
- Events: None
- Key features:
  - Handles OAuth code exchange
  - Stores authentication tokens
  - Retrieves user information

### `TootComposer.vue`
The main interface for composing and scheduling toots.
- Props: None
- Events: None
- Key features:
  - Content input with character limit
  - Media upload and preview
  - Date and time scheduling
  - Visibility selection

## Composables

### `useMastodonApi`
Provides a typed interface to the Mastodon API.

```typescript
function useMastodonApi() {
  // Methods
  registerApplication(instanceUrl: string): Promise<{ client_id: string, client_secret: string }>
  getAccessToken(code: string, clientId: string, clientSecret: string): Promise<{ access_token: string }>
  verifyCredentials(): Promise<MastodonAccount>
  scheduleToot(toot: ScheduledToot): Promise<MastodonStatus>
  uploadMedia(file: File): Promise<{ id: string }>
  getScheduledToots(): Promise<MastodonStatus[]>
}
```

## Types

### `MastodonAccount`
```typescript
interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}
```

### `MastodonStatus`
```typescript
interface MastodonStatus {
  id: string;
  content: string;
  created_at: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  url: string;
  media_attachments: any[];
  scheduled_at?: string;
}
```

### `ScheduledToot`
```typescript
interface ScheduledToot {
  status: string;
  media_ids?: string[];
  scheduled_at?: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
}
```

## Router

The application uses Vue Router with the following routes:

```typescript
const routes = [
  {
    path: '/',
    name: 'home',
    component: TootComposer,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginForm
  },
  {
    path: '/oauth/callback',
    name: 'oauth-callback',
    component: OAuthCallback
  }
]
```

## State Management

### `auth` Store (Pinia)
Manages authentication state and user information.

```typescript
interface AuthStore {
  // State
  accessToken: string | null
  account: MastodonAccount | null
  instance: string | null
  clientId: string | null
  clientSecret: string | null

  // Actions
  setAccessToken(token: string): void
  setInstance(instanceUrl: string): void
  setClientCredentials(id: string, secret: string): void
  setAccount(accountData: MastodonAccount): void
  logout(): Promise<void> // Clears credentials and redirects to login
}
```

### Authentication Flow

1. **Login**:
   - User enters Mastodon instance URL
   - Application registers with the instance
   - User is redirected to Mastodon for authorization
   - On callback, tokens are stored and user is redirected to home

2. **Logout**:
   - User clicks logout button
   - All credentials are cleared from state and localStorage
   - User is automatically redirected to login page
   - Async operation ensures proper cleanup before redirection

## Setup and Configuration

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with:
```env
VITE_REDIRECT_URI=http://localhost:5173/oauth/callback
```

4. Start the development server:
```bash
npm run dev
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_REDIRECT_URI` | OAuth callback URL | Yes |

## Security Considerations

- All sensitive data (tokens, client credentials) is stored in memory and localStorage
- HTTPS is required for production deployment
- OAuth flow follows security best practices
- Credentials are never exposed in URLs
- Complete credential cleanup on logout

## Browser Support

The application supports all modern browsers that support ES6+ features:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

## Acknowledgments

- Built with [Vue 3](https://vuejs.org/)
- Date handling with [date-fns](https://date-fns.org/)
- HTTP client [Axios](https://axios-http.com/)
