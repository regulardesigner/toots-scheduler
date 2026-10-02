# Red Team Remediation — Spec d'intégration

**Source :** [docs/audits/2026-10-01-red-team-report.md](../../audits/2026-10-01-red-team-report.md) (IDs `SEC-*`, `BUG-*`, `WEB-*`, `CC-*`).
**Usage :** entrée directe pour `superpowers-extended-cc:writing-plans`. Chaque lot est conçu pour devenir **un plan autonome** (ou une phase d'un plan), livrable et déployable seul, dans l'ordre indiqué.
**Skills à charger à l'exécution :** `vue3-codegen`, `web-security`, `mastodon-api`, `ui-design-system` (lots avec UI), `changelog` (fin de chaque lot livré).

---

## Principes transverses

1. **Lot 0 d'abord** : sans tests ni typecheck réel, le TDD exigé par writing-plans est impossible. Tous les lots suivants en dépendent.
2. **Un lot = une release** : bump de version et entrée « What's New » via le skill `changelog` (version patch pour les correctifs, minor pour le lot 3).
3. **Tests** : Vitest + @vue/test-utils + happy-dom. Mock HTTP via `vi.mock` du client API (pas de vrai réseau). Les fonctions pures (`utils/`) sont testées en premier.
4. **Pas de nouvelle dépendance runtime** sauf justification (`web-security` §7). `zod` et `@vueuse/core` sont déjà présents.
5. **Conventions** : setup stores Pinia, `<script setup lang="ts">`, aucun `any` nouveau.

## Décisions (toutes tranchées le 2026-10-01)

| # | Question | Options | Recommandation |
|---|---|---|---|
| D1 | Stockage du token (SEC-03, SEC-04b) | a) `sessionStorage` · b) `localStorage` + expiration d'inactivité réelle + révocation · c) backend (BFF, cookie HttpOnly) | ✅ **Décidé (2026-10-01) : b, « option A ».** L'app reste **100 % statique** ; le BFF est écarté. Le token reste en `localStorage`, mais il expire réellement après 30 min d'inactivité (y compris onglet fermé), avec révocation côté instance. Compromis à documenter dans le README : une XSS peut toujours lire le token pendant une session active, d'où la CSP (Lot 3). |
| D2 | Conservation du `client_secret` | a) supprimé après l'échange du code · b) conservé pour `/oauth/revoke` | ✅ **Décidé : b**, isolé dans une clé unique `mastodon_auth` (JSON), et nettoyé au logout. |
| D3 | Édition d'un toot (BUG-01) | a) create puis delete · b) `PUT` si seule la date change, sinon a) | ✅ **Décidé : b** |
| D4 | Bouton « Say Thanks » (SEC-12) | a) modale de confirmation · b) suppression | ✅ **Décidé : a** |

---

## Lot 0 — Socle qualité & CI (CC-01, CC-02, SEC-01, SEC-10)

> ✅ **Livré en 0.13.1** : branche `chore/lot-0-quality-gate`, plan [2026-10-01-lot-0-quality-gate.md](../plans/2026-10-01-lot-0-quality-gate.md).

**Objectif :** rendre le typecheck réel, introduire tests et lint, bloquer un déploiement non conforme, assainir les dépendances.

**Fichiers :** `package.json`, `tsconfig.app.json`, `vite.config.ts` (bloc `test`), `eslint.config.js` (nouveau), `.github/workflows/deploy.yml`, suppression de `yarn.lock`, `.env.example`, + correction des 5 erreurs TS (`ScheduledToots.vue`, `TootCard.vue`, `useMastodonApi.ts`, `ContentWarning.vue`, `router/index.ts`).

**Contenu :**
- `"build": "vue-tsc -b && vite build"`, `"typecheck": "vue-tsc -b"`, `"test": "vitest run"`, `"lint": "eslint ."`.
- devDeps : `vitest`, `@vue/test-utils`, `happy-dom`, `eslint`, `eslint-plugin-vue`, `typescript-eslint`.
- ESLint : `vue/no-v-html: error`, `no-console: ['warn', { allow: ['error'] }]`, `@typescript-eslint/no-explicit-any: warn`.
- Types : `TootCard` reçoit `poll?: ScheduledToot['poll']`, et `onDelete`/`onEdit` sont typés `(id: string) => void` (ou remplacés par des `emit`, préférable).
- `npm audit fix`, axios bumpé à la version corrigée des GHSA-3g43 / 35jp / 898c.
- CI : nouveau job `verify` (`npm ci → lint → typecheck → test → npm audit --omit=dev --audit-level=high`), puis `deploy` en `needs: verify`. Ajouter `pull_request` en trigger pour `verify` seul.
- Retirer `VITE_MASTODON_*` du step Build et de `.env.example`.
- Un premier test fumée (`normalizeUrl`) pour valider la chaîne.

**Critères d'acceptation :**
- `npm run typecheck` ne remonte aucune erreur, et l'ajout volontaire d'une erreur TS fait échouer `npm run build`.
- `npm test`, `npm run lint` (0 erreur) et `npm audit --omit=dev --audit-level=high` passent.
- `yarn.lock` est absent, et le workflow déploie uniquement si `verify` passe.

---

## Lot 1 — Intégrité des données (BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-07, CC-03)

> ✅ **Livré en 0.13.2** : branche `fix/lot-1-data-integrity`, plan [2026-10-02-lot-1-data-integrity.md](../plans/2026-10-02-lot-1-data-integrity.md). Validé sur une vraie instance le 2026-10-02 (contrôles 1 à 13 ; le 6 est bloqué par l'interface, comme prévu).

**Objectif :** ne plus jamais perdre, dupliquer ou masquer un toot programmé.

**Fichiers :** `src/utils/buildScheduledToot.ts` (nouveau) + test, `src/composables/useMastodonApi.ts`, `src/stores/scheduledToots.ts` (migré en setup store, CC-06), `src/components/Toot/TootComposer.vue`, `src/components/ControlsBar.vue`, `src/components/Toot/PollSection.vue`, `.claude/skills/mastodon-api/SKILL.md` (l.109).

**Design :**
- `buildScheduledToot(form: ComposerForm): ScheduledToot`, une fonction pure. Elle inclut `poll` **uniquement si** `form.showPoll` et au moins 2 options non vides, et n'inclut jamais `poll` et `media_ids` ensemble. `spoiler_text` n'est rempli que si `sensitive`.
- `scheduleToot(toot, idempotencyKey)` : header `Idempotency-Key`, suppression du champ `idempotency` du body. La clé est un `crypto.randomUUID()` généré à l'ouverture du brouillon, puis régénéré après un succès ou un `resetForm`.
  *Implémenté (0.13.2) : la clé n'est réutilisée que pour un nouvel essai identique (empreinte du contenu et du toot édité) ; voir les notes de relecture du plan Lot 1.*
- Édition (D3) : si seul `scheduled_at` diffère, `PUT /api/v1/scheduled_statuses/:id`. Sinon, `scheduleToot(new)`, et `deleteScheduledToot(old)` **seulement après succès**. Si la suppression échoue, toast d'avertissement « l'ancienne version existe encore ».
- `getScheduledToots()` : `limit=40`, suit le header `Link rel="next"` jusqu'à épuisement (plafond : 10 pages).
- Bouton submit : prop `isSubmitting`, avec `:disabled` et le libellé « Scheduling… ».
- Édition : `language.value = newToot.params?.language ?? 'en'`. Fermer le sondage réinitialise `pollData`.
- `PollSection` : `v-model.number` sur la durée.
- Corriger la doc du skill mastodon-api (header et non body).
- Type partagé `PollParams` dans `src/types/mastodon.ts` (la même forme de sondage est dupliquée l.11, l.25, l.59 et dans `TootComposer.vue`), utilisé par `buildScheduledToot`, `TootCard` et `PollSection`. *(Différé depuis la revue du Lot 0.)*

**Tests (TDD) :**
- `buildScheduledToot` : poll fermé → pas de poll ; poll + media → poll ignoré (ou erreur explicite) ; options vides filtrées ; `expires_in` numérique.
- Store `updateToot` : création en échec → `delete` non appelé ; seule la date change → `PUT` appelé, ni create ni delete.
- `getScheduledToots` : 2 pages via `Link` → 2 appels, résultats concaténés.
- `scheduleToot` : envoie le header `Idempotency-Key` et aucun champ `idempotency` dans le body.
- `TootComposer` : double-clic → un seul appel API.

**Critères d'acceptation :** tous les tests ci-dessus passent, et en manuel, une édition sur instance réelle avec date passée n'entraîne aucune perte.

---

## Lot 2 — Durcissement auth & OAuth (SEC-02, SEC-03, SEC-04, SEC-04b, SEC-05, SEC-06, SEC-08, SEC-09, CC-05, WEB-03)

**Objectif :** un flux OAuth conforme RFC 9700 (state + PKCE), un token qui expire réellement après 30 min d'inactivité et qui est révoqué au logout, une gestion globale des 401, un client HTTP unique.

**Fichiers :** `src/utils/url.ts` + test, `src/utils/pkce.ts` (nouveau) + test, `src/utils/api.ts`, `src/composables/useMastodonApi.ts`, `src/stores/auth.ts`, `src/components/Auth/LoginForm.vue`, `src/components/OAuthCallback.vue`, `src/composables/useSessionTimeout.ts`, `src/config/constants.ts` (nouveau : scopes, redirect URI, durées), `vite.config.ts`.

**Design :**
- `normalizeUrl(input)` : préfixe `https://` si aucun schéma, **rejette** `http:` (sauf `localhost`/`127.0.0.1` quand `import.meta.env.DEV`), retourne `origin`.
- `pkce.ts` : `createPkcePair()` → `{ verifier, challenge }` (`crypto.getRandomValues` + SHA-256 via `crypto.subtle`, base64url).
- Login : `state` + `verifier` en `sessionStorage` (`oauth_state`, `oauth_verifier`). L'URL d'autorisation inclut `state`, `code_challenge` et `code_challenge_method=S256`.
- Callback : gère `?error=` (message clair), vérifie `state` **avant** l'échange, envoie `code_verifier`, supprime les clés de session dans un `finally`, puis `history.replaceState` pour retirer `code` de l'URL.
- Client unique (`createApiClient(instance)`) avec `baseURL = instance` et chemins relatifs, ce qui supprime la comparaison par préfixe (SEC-08). Interceptor de réponse : sur 401, `auth.logout({ revoke: false })` puis toast. `uploadMedia` passe sur axios avec `onUploadProgress` (suppression du XHR).
- Store auth : stockage regroupé sous une clé `mastodon_auth` (D1/D2), avec migration silencieuse des 4 anciennes clés. `logout()` fait un `POST /oauth/revoke` en best-effort (timeout 5 s, erreurs ignorées) avant le nettoyage. Suppression de `useRouter()` dans le store : le router est importé directement, ou la navigation est déléguée à l'appelant.
- Logs : utilitaire `logger` actif uniquement en `DEV`, et `esbuild.drop: ['console', 'debugger']` en build prod.
- Erreurs : lors d'un re-throw dans `useMastodonApi` et les stores, conserver la cause (`new Error(message, { cause: err })`) au lieu d'écraser l'erreur d'origine. *(Différé depuis la revue du Lot 0.)*
- **Expiration d'inactivité persistante (option A, D1)** :
  - `src/utils/session.ts` (fonctions pures + test) : `isSessionExpired(lastActivityAt: number | null, now: number, duration: number): boolean`. Une valeur absente ou invalide est considérée comme expirée lorsqu'un token est présent.
  - `lastActivityAt` stocké dans l'objet `mastodon_auth`, et écrit au login puis sur activité, **throttlé à 30 s max** (`useThrottleFn` de @vueuse/core). Cela couvre aussi WEB-03 : plus de reset de timers à chaque `mousemove`. Événements écoutés : `pointerdown`, `keydown`, `scroll` (passive), `visibilitychange`.
  - `initializeFromStorage()` : **avant** tout `verify_credentials`, si `isSessionExpired(...)`, alors `logout({ revoke: true })` et toast « Session expirée après 30 min d'inactivité ». Le token n'est jamais utilisé pour autre chose que sa révocation.
  - `useSessionTimeout` : les timers en mémoire sont recalculés depuis `lastActivityAt` (et non depuis le montage). L'expiration en cours de session appelle `logout({ revoke: true })`.
  - Multi-onglets : écoute de l'événement `storage`. Si `mastodon_auth` disparaît, l'onglet se déconnecte ; si `lastActivityAt` avance, les timers locaux sont replanifiés (l'activité dans un onglet prolonge les autres).
  - `SESSION_DURATION` (30 min) et `WARNING_BEFORE` (5 min) déplacés dans `src/config/constants.ts`, et suppression des commentaires « For testing » obsolètes.
  - README : section « Sécurité » décrivant le compromis (token en `localStorage`, expiration 30 min, révocation, pas de backend).

**Tests (TDD) :**
- `isSessionExpired` : 29 min → false ; 31 min → true ; `null` → true ; `NaN` → true ; horloge reculée (`lastActivityAt > now`) → false.
- `initializeFromStorage` avec `lastActivityAt` vieux de 31 min → `/oauth/revoke` appelé, **`verify_credentials` jamais appelé**, stockage purgé, route `home`.
- `initializeFromStorage` avec `lastActivityAt` vieux de 10 min → `verify_credentials` appelé, session restaurée.
- Throttle : 100 `pointerdown` en 1 s → au plus 1 écriture `localStorage`.
- Multi-onglets : un événement `storage` simulant la suppression de `mastodon_auth` déclenche le logout local (sans second revoke).
- Migration : les anciennes clés (`mastodon_token`…) sans `lastActivityAt` sont traitées comme une session expirée, ce qui force une reconnexion propre une fois après la mise à jour.
- `normalizeUrl` : `mastodon.social` → `https://mastodon.social` ; `http://x.tld` → erreur ; `https://x.tld/path?q` → `https://x.tld` ; `javascript:alert(1)` → erreur.
- `createPkcePair` : verifier de 43 à 128 caractères au format base64url ; challenge = SHA-256 du verifier (vecteur RFC 7636 annexe B).
- Callback : state absent ou différent → pas d'appel `/oauth/token` et erreur affichée ; `?error=access_denied` → message dédié ; succès → clés de session effacées.
- Logout : `/oauth/revoke` appelé avec token et credentials ; un échec de revoke n'empêche pas le nettoyage local.
- Interceptor : une réponse 401 déclenche le logout.

**Critères d'acceptation :** les tests passent ; en manuel :
- login complet sur mastodon.social, puis après logout, l'app n'apparaît plus dans *Préférences → Applications autorisées* ;
- login, fermeture de l'onglet, puis modification de `lastActivityAt` à −31 min dans les DevTools : à la réouverture, l'utilisateur arrive déconnecté avec le toast d'expiration, et le token est révoqué côté instance ;
- deux onglets ouverts : un logout dans l'un déconnecte l'autre.

---

## Lot 3 — CSP & défense en profondeur (SEC-03 CSP, WEB-04, SEC-07, SEC-11, SEC-12, BUG-11)

**Objectif :** limiter l'impact d'une XSS future et ne plus faire confiance aux réponses de l'instance.

**Fichiers :** `index.html`, `public/spa-redirect.js` (nouveau), `src/schemas/mastodon.ts` (nouveau, zod) + test, `src/types/mastodon.ts` (types dérivés via `z.infer`), `src/composables/useMastodonApi.ts`, `src/components/MediaUpload.vue`, `src/App.vue`, `src/components/Modals/ThanksConfirmModal.vue` (nouveau).

**Design :**
- Le script inline de redirection est déplacé dans `public/spa-redirect.js`, chargé via `<script src="/toots-scheduler/spa-redirect.js">` avant le module principal.
- `<meta http-equiv="Content-Security-Policy">` : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src https:; connect-src 'self' https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`. Le favicon `data:` est couvert par `img-src data:`. Vérifier en preview que vue-toastification fonctionne avec `style-src 'unsafe-inline'`.
- Schémas zod (`Account`, `ScheduledStatus`, `MediaAttachment`, `AppRegistration`, `TokenResponse`) : `safeParse` dans chaque fonction API, et en cas d'échec, une erreur utilisateur générique, sans exposer le détail. Les URLs d'images (`avatar`, `preview_url`) doivent être en `https:`.
- Upload : whitelist `image/jpeg|png|gif|webp|avif` avant envoi (y compris au drop), et clé de progression `crypto.randomUUID()` (BUG-10).
- Bouton « Say Thanks » : modale de confirmation (D4) affichant le message exact, avec propagation de l'erreur pour un toast d'échec réel. Le handle destinataire passe en constante.

**Tests :** schémas (réponse valide acceptée, `media_attachments` non tableau rejeté, avatar `javascript:` rejeté) ; upload `application/pdf` déposé → refusé sans appel API ; thanks en échec → toast d'erreur.

**Critères d'acceptation :** `npm run build && npm run preview` → login, programmation, upload et suppression fonctionnent **sans aucune violation CSP en console** ; tests verts.

---

## Lot 4 — Accessibilité & UX de fiabilité (WEB-01, WEB-07, BUG-06, BUG-08, BUG-09, CC-10)

**Objectif :** une app utilisable au clavier et au lecteur d'écran, et des limites dictées par l'instance.

**Fichiers :** `src/components/Modals/ModalView.vue`, `src/App.vue`, `src/components/Toot/TootCard.vue`, `src/components/Toot/ScheduledToots.vue`, `src/components/ContentArea.vue`, `src/components/ControlsBar.vue`, `src/components/LandingPage.vue`, `src/components/Auth/LoginForm.vue`, `src/stores/instance.ts` (nouveau, setup store) + test.

**Design :**
- `ModalView` : prop `labelledBy`, bouton de fermeture `aria-label="Close"`, focus restauré seulement si la modale a été ouverte, suppression du `<slot @close-child-modal>` mort. Harmoniser l'événement en `close` (LoginForm/LandingPage).
- Burger : `aria-label`, `aria-expanded`, `aria-controls`, fermeture via `Escape`.
- Un seul `<h1>` par vue (titre d'app en `<p>` ou `<h1>` selon la route), `<main>` dans `App.vue` autour du `RouterView`.
- `TootCard` : `id` uniques (`sensitive-${id}`), suppression du `@click` redondant, conversion des props callback en `emit('edit'|'delete')`. L'état de chargement devient par carte (`pendingId` dans le store).
- Compteur en `aria-live="polite"`, erreurs en `role="alert"`, cases media/poll avec un `<label>` (visuellement masqué si nécessaire, selon `ui-design-system`).
- Store `instance` : `GET /api/v2/instance` au login, qui expose `maxCharacters`, `maxMediaAttachments`, `imageSizeLimit` et `supportedMimeTypes` (valeurs par défaut actuelles en fallback). Branché sur ContentArea, MediaUpload et le Lot 3 (whitelist MIME).
- Fuseau affiché : `Intl.DateTimeFormat().resolvedOptions().timeZone` sous les champs date/heure et sur les cartes.

**Tests :** ModalView (Escape ferme ; focus initial sur le premier focusable ; pas de refocus si jamais ouverte) ; deux TootCard → `id` distincts ; ContentArea respecte `maxCharacters` du store ; store instance en fallback si l'API échoue.

**Critères d'acceptation :** parcours complet au clavier (login → programmation → édition → suppression) ; aucune violation « serious/critical » sur un passage axe DevTools (Lighthouse a11y ≥ 95).

---

## Lot 5 — Performance & hygiène (WEB-02, WEB-05, WEB-06, CC-04, CC-06, CC-07, CC-08, CC-09)

**Objectif :** alléger le bundle et supprimer le code mort et la duplication.

**Fichiers :** `src/assets/fonts/**`, `src/assets/styles/fonts.css`, `src/composables/useSessionTimeout.ts`, `src/main.ts`, `index.html`, `src/config/constants.ts`, `src/stores/features.ts`, `src/types/features.ts`, `package.json`, composants touchés par les constantes.

**Design :**
- Polices : conversion en WOFF2 avec subset latin + latin-ext (outil de build ponctuel, binaires versionnés), `format('woff2-variations')`, suppression des 16 TTF statiques et des TTF variables. Objectif : moins de 300 Ko au total.
- `app.config.errorHandler` + `window.onunhandledrejection` → toast générique, avec log en DEV uniquement.
- `index.html` : `meta description`, `theme-color`, OG minimal ; suppression de `public/vite.svg` et `src/assets/vue.svg`.
- `constants.ts` : langues (partagées par TootCard et ControlsBar), scopes, limites par défaut.
- `features.ts` : `JSON.parse` sous `try/catch` avec fallback, renommage `lastThreeNewFeatures` → `recentNewFeatures`, suppression de `APP_VERSION`.
- Suppression de `@vueuse/components` (et de `@vueuse/core` s'il n'est pas utilisé après le lot).
- `eslint.config.js` : bloc `{ files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } }`, car aujourd'hui `vite.config.ts` n'est accepté que parce que typescript-eslint désactive `no-undef`. *(Différé depuis la revue du Lot 0.)*
- Purge des JSDoc dupliquées dans les objets retournés, simplification des toggles (`showMedia.value = !showMedia.value`).

**Critères d'acceptation :** taille des polices < 300 Ko dans `dist/assets` ; aucune dépendance listée non importée (vérifiable avec `npx depcheck`) ; Lighthouse perf ≥ 90 sur la landing ; tests, lint et typecheck verts.

---

## Graphe de dépendances

```
Lot 0 ──► Lot 1 ──► Lot 2 ──► Lot 3
                         └──► Lot 4 ──► Lot 5
```
- Lot 2 avant Lot 3 : la CSP et zod s'appuient sur le client API unifié.
- Lot 4 dépend de Lot 2 (le store `instance` utilise le nouveau client) et alimente la whitelist MIME du Lot 3 : si le Lot 3 passe en premier, il garde une whitelist statique, remplacée ensuite.
- Le Lot 5 peut être parallélisé partiellement (polices) dès le Lot 0.

## Vérification utilisateur

Validation humaine recommandée à la fin des **Lots 1, 2 et 3**, sur une vraie instance Mastodon (perte de données, flux OAuth, CSP) : ces comportements ne sont pas couverts par les tests unitaires mockés. À encoder comme tâches `requiresUserVerification: true` lors de writing-plans.
