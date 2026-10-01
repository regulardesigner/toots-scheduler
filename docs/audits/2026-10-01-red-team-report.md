# Toot Scheduler — Rapport d'audit Red Team

**Date :** 2026-10-01 · **Version auditée :** 0.13.0 (`7822d95`) · **Périmètre :** `src/`, `index.html`, `public/404.html`, `vite.config.ts`, `.github/workflows/deploy.yml`, dépendances.

**Axes :** sécurité web (OWASP / RFC 9700, checklist `.claude/skills/web-security`), bonnes pratiques web (a11y, perf, robustesse), clean code (Vue 3 / TS, conventions du projet).

**Méthode :** lecture intégrale du code source (~5 k lignes hors CSS), `npm audit`, typecheck réel (`vue-tsc -p tsconfig.app.json`), build de production, confrontation à la doc Mastodon (`.claude/skills/mastodon-api/references/endpoints.md`).

---

## 1. Synthèse

L'application est petite, lisible et ne contient **aucun `v-html`** : il n'y a donc pas de vecteur XSS direct aujourd'hui. Le risque réside dans le **cumul** : le token et le `client_secret` sont dans `localStorage`, aucune CSP n'est en place et une dépendance runtime (axios) a des CVE de vol de credentials. Une seule faille introduite demain suffirait à compromettre le compte Mastodon de l'utilisateur, avec les droits d'écriture.

Côté fiabilité, trois bugs peuvent **faire perdre ou dupliquer des toots** (édition = delete puis create, absence d'idempotence réelle et bouton non désactivé, pagination ignorée). Côté qualité, le garde-fou est illusoire : **`npm run build` passe alors que le typecheck échoue** (5 erreurs masquées), et il n'existe ni tests, ni linter, ni gate CI.

| Sévérité | Sécurité | Fiabilité / bugs | Web best practices | Clean code |
|---|---|---|---|---|
| Critique | 1 | 1 | – | 1 |
| Haute | 4 | 3 | – | 1 |
| Moyenne | 4 | 4 | 4 | 3 |
| Basse | 5 | 3 | 3 | 6 |

---

## 2. Sécurité

### SEC-01 — Dépendances vulnérables, dont axios en runtime · **Critique**
`npm audit` : 5 vulnérabilités (1 critique, 3 hautes, 1 modérée) avant installation des devDeps, d'autres côté tooling (`postcss`, `nanoid`, `brace-expansion`, `follow-redirects`, `form-data`).
- **axios 1.8.x** (runtime) : GHSA-3g43-6gmg-66jw *Credential Theft and Response Hijacking via Prototype Pollution Gadget*, GHSA-35jp-ww65-95wh (MITM via `config.proxy`), GHSA-898c-q2cr-xwhg (header injection).
- Le CI (`deploy.yml`) déploie sur push `main` sans aucun `npm audit`.

**Reco :** `npm audit fix`, bump axios ≥ version corrigée, ajout d'un step `npm audit --audit-level=high --omit=dev` bloquant en CI. Supprimer `yarn.lock` (le CI utilise npm, et deux lockfiles divergent ; `npm ci` réécrit d'ailleurs `yarn.lock`).

### SEC-02 — OAuth sans `state` ni PKCE · **Haute**
[LoginForm.vue:34-42](../../src/components/Auth/LoginForm.vue#L34-L42) construit l'URL d'autorisation sans `state` ; [OAuthCallback.vue:15-27](../../src/components/OAuthCallback.vue#L15-L27) échange tout `code` reçu sans vérification.
- Risque : login CSRF / injection de code (RFC 9700 §4.7). L'impact est limité, car le `client_id` est enregistré dynamiquement par l'utilisateur, mais la recommandation RFC 9700 pour les clients publics est **PKCE obligatoire**, que Mastodon supporte (`code_challenge_method=S256`, Mastodon ≥ 4.3).
- Le paramètre `error` du callback (refus utilisateur) n'est pas traité : l'utilisateur voit « No authorization code found ».

**Reco :** `state = crypto.randomUUID()` et `code_verifier` stockés en `sessionStorage`, vérification du state avant l'échange, puis suppression immédiate des deux valeurs. Envoyer `code_verifier` à `/oauth/token`. Gérer `?error=access_denied`.

### SEC-03 — Token + `client_secret` dans `localStorage`, sans CSP · **Haute**
[auth.ts:23-47](../../src/stores/auth.ts#L23-L47) persiste `mastodon_token`, `mastodon_client_secret`, etc. dans `localStorage`. Aucune CSP n'est définie dans [index.html](../../index.html).
- N'importe quel script exécuté sur l'origine (`regulardesigner.github.io`, partagée avec d'autres repos Pages du même compte) peut lire le token. Les scopes `write:statuses write:media` permettent de publier au nom de l'utilisateur.
- Les tokens Mastodon **n'expirent pas** (endpoints.md l.98).

**Reco :**
1. Ajouter une CSP en `<meta>` (`default-src 'self'; script-src 'self'; connect-src 'self' https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; object-src 'none'`). Cela impose de **sortir le script inline** de `index.html` (voir WEB-04).
2. Décision produit à trancher : `sessionStorage` (reconnexion à chaque onglet) ou maintien de `localStorage` documenté comme compromis assumé. Le `client_secret` n'a aucune raison d'être conservé après l'échange du code, sauf pour la révocation (SEC-04).

### SEC-04 — Logout et timeout d'inactivité sans révocation · **Haute**
[auth.ts:61-74](../../src/stores/auth.ts#L61-L74) efface le stockage local mais n'appelle jamais `POST /oauth/revoke`. Le token reste valide indéfiniment côté instance. Le timeout de 30 min ([useSessionTimeout.ts](../../src/composables/useSessionTimeout.ts)) donne donc un **faux sentiment de sécurité**, et la FAQ affirme « Is it totally secure? Yes ».

**Reco :** `POST {instance}/oauth/revoke` (client_id, client_secret, token) en best-effort avant le nettoyage local, sur logout manuel comme sur timeout.

### SEC-04b — Le timeout d'inactivité ne survit pas à la fermeture de l'onglet · **Haute**
[useSessionTimeout.ts](../../src/composables/useSessionTimeout.ts) repose uniquement sur des `setTimeout` en mémoire, sans horodatage persisté. Si l'onglet est fermé puis rouvert (même des semaines plus tard), [auth.ts:81](../../src/stores/auth.ts#L81) relit le token depuis `localStorage` et reconnecte l'utilisateur. La promesse « déconnexion après 30 min d'inactivité » n'est tenue que si l'onglet reste ouvert, ce qui n'est pas le cas le plus courant.
**Reco :** persister `lastActivityAt` (écriture throttlée) ; au démarrage, si `now - lastActivityAt > SESSION_DURATION`, révoquer puis purger avant toute utilisation du token. Synchroniser les onglets via l'événement `storage`.

### SEC-05 — Instance en HTTP acceptée · **Moyenne**
`pattern="https?://.*"` dans [LoginForm.vue:64](../../src/components/Auth/LoginForm.vue#L64) et [url.ts](../../src/utils/url.ts), qui n'impose pas le protocole. Le token transiterait en clair.
**Reco :** `normalizeUrl` rejette tout protocole ≠ `https:` (sauf `localhost` en dev). Accepter aussi la saisie `mastodon.social` sans schéma, en préfixant `https://`.

### SEC-06 — 401 non gérés globalement · **Moyenne**
Hors démarrage, un token révoqué produit des erreurs affichées en boucle, sans logout. **Reco :** interceptor de réponse axios : sur 401, logout puis toast.

### SEC-07 — Réponses API non validées · **Moyenne**
`zod` est installé mais **jamais importé**. Les réponses sont typées `any` puis castées. Une instance malveillante ou buggée peut faire planter l'UI (`toot.params.text` absent, `media_attachments` non tableau…).
**Reco :** schémas zod pour `Account`, `ScheduledStatus`, `MediaAttachment`, `/apps`, `/oauth/token`, parsés dans `useMastodonApi`.

### SEC-08 — Comparaison d'origine par préfixe dans l'interceptor · **Moyenne**
[api.ts:14](../../src/utils/api.ts#L14) : `config.url?.startsWith(auth.instance)` est vrai pour `https://mastodon.social.evil.tld/...`. L'exploitation n'est pas possible aujourd'hui (les URLs sont construites depuis `auth.instance`), mais c'est un piège pour du futur code.
**Reco :** `new URL(config.url).origin === auth.instance`, ou mieux `baseURL: auth.instance` et des chemins relatifs.

### SEC-09 — Fuite de données dans la console · **Basse**
18 `console.*`, dont le dump complet des toots programmés et de l'account ([useMastodonApi.ts:229-233](../../src/composables/useMastodonApi.ts#L229-L233), [TootComposer.vue:123-128](../../src/components/Toot/TootComposer.vue#L123-L128)). **Reco :** logger `import.meta.env.DEV` uniquement, ou `esbuild.drop: ['console']` en prod.

### SEC-10 — Secrets CI inutiles injectés dans le build · **Basse**
[deploy.yml:38-41](../../.github/workflows/deploy.yml#L38-L41) passe `VITE_MASTODON_CLIENT_SECRET` au build. Ces variables ne sont pas utilisées, mais tout `VITE_*` référencé un jour serait **publié dans le bundle**. **Reco :** les supprimer, ainsi que leur mention dans `.env.example`.

### SEC-11 — Upload sans contrôle MIME au drop · **Basse**
`accept="image/*"` ne s'applique pas au drag & drop ([MediaUpload.vue:31-76](../../src/components/MediaUpload.vue#L31-L76)). **Reco :** whitelist `file.type` (jpeg/png/gif/webp/avif), avec l'instance comme autorité finale.

### SEC-12 — « Say Thanks » publie sans confirmation · **Basse**
Un clic envoie un DM au nom de l'utilisateur, avec une mention codée en dur `@dams@disabled.social` ([useMastodonApi.ts:150-157](../../src/composables/useMastodonApi.ts#L150-L157)). Action sortante non confirmée, et l'erreur est avalée (le toast affiche toujours « success »). **Reco :** modale de confirmation, propagation de l'erreur, handle en constante de config.

### SEC-13 — Script de redirection 404 · **Info (OK)**
`public/404.html` et le script de `index.html` restent same-origin (`replaceState`, slashes de tête retirés). Il n'y a pas d'open redirect, mais le script inline bloque une CSP stricte.

---

## 3. Fiabilité / bugs fonctionnels

### BUG-01 — L'édition supprime avant de recréer : perte de toot · **Critique**
[scheduledToots.ts:60-82](../../src/stores/scheduledToots.ts#L60-L82) : `delete` puis `scheduleToot`. Si la création échoue (validation, réseau, rate-limit 429, date passée), **le toot original est perdu**.
**Reco :** créer d'abord, supprimer ensuite. Si seule la date change, utiliser `PUT /api/v1/scheduled_statuses/:id` (`scheduled_at` uniquement).

### BUG-02 — Double soumission : doublons · **Haute**
- Le bouton submit de [ControlsBar.vue:104-109](../../src/components/ControlsBar.vue#L104-L109) n'est jamais désactivé (`isSubmitting` n'est pas transmis).
- L'« idempotency » est envoyée dans le **body** ([useMastodonApi.ts:104](../../src/composables/useMastodonApi.ts#L104)), où Mastodon l'ignore : l'API attend le header `Idempotency-Key` (endpoints.md l.135). En plus, `Date.now()` change à chaque clic.
- ⚠️ Le skill `.claude/skills/mastodon-api/SKILL.md:109` documente cette erreur et la propagera : il faut le corriger aussi.

**Reco :** header `Idempotency-Key` = UUID généré une fois par brouillon, bouton `:disabled="isSubmitting"`.

### BUG-03 — Pagination ignorée : toots invisibles · **Haute**
`GET /api/v1/scheduled_statuses` renvoie **20 éléments par défaut** (max 40). Au-delà, les toots ne sont ni affichés ni comptés. **Reco :** `limit=40` et suivi du header `Link` (`rel="next"`) jusqu'à épuisement, avec un plafond raisonnable.

### BUG-04 — Le sondage est envoyé même quand la section est fermée · **Haute**
[TootComposer.vue:162,181](../../src/components/Toot/TootComposer.vue#L162) : le poll est inclus si `pollData.options` contient du texte, **indépendamment de `showPoll`**. Si l'utilisateur ouvre un sondage, le remplit, le referme et ajoute des médias, la requête part avec poll + media et l'API la rejette (ou publie un sondage non voulu).
**Reco :** n'inclure le poll que si `showPoll`, et vider `pollData` à la fermeture.

### BUG-05 — La langue est perdue à l'édition · **Moyenne**
[TootComposer.vue:72](../../src/components/Toot/TootComposer.vue#L72) lit `newToot.language`, qui n'existe pas sur un ScheduledStatus, au lieu de `newToot.params.language`. Résultat : retour systématique à `en`.

### BUG-06 — Cartes « sensitive » : `id` dupliqués · **Moyenne**
[TootCard.vue:95-97](../../src/components/Toot/TootCard.vue#L95-L97) : `id="sensitive"` est répété sur chaque carte. Cliquer le label d'une carte bascule la **première** carte. Le `@click` et le `v-model` sont redondants sur la même case.

### BUG-07 — Durée de sondage envoyée en string · **Moyenne**
`<option value="300">` sans `:value` : `expiresIn` devient une string, contrairement au type `number` ([PollSection.vue:89-97](../../src/components/Toot/PollSection.vue#L89-L97)). **Reco :** `v-model.number`.

### BUG-08 — Limite de 500 caractères codée en dur · **Moyenne**
Beaucoup d'instances autorisent plus (ou moins). **Reco :** lire `configuration.statuses.max_characters` via `GET /api/v2/instance`. Même chose pour les limites médias (4 fichiers, 8 Mo).

### BUG-09 — Câblage d'événements mort · **Basse**
`LoginForm` émet `close-child-modal`, mais `LandingPage` écoute `@close-modal`. `<slot @close-child-modal>` dans [ModalView.vue:123](../../src/components/Modals/ModalView.vue#L123) n'a aucun effet (les slots ne prennent pas de listeners).

### BUG-10 — Upload multiple : état fragile · **Basse**
Progression indexée par `file.name` (collision si deux fichiers portent le même nom), et `emit([...props.modelValue, media])` dans une boucle `await`, qui dépend du re-render parent. **Reco :** accumuler localement, puis un seul emit, avec une clé `crypto.randomUUID()`.

### BUG-11 — « Thanks » toujours en succès · **Basse**
`sendDirectThanksNotification` avale l'exception ([useMastodonApi.ts:154](../../src/composables/useMastodonApi.ts#L154)), donc le `catch` d'[App.vue:40](../../src/App.vue#L40) n'est jamais atteint.

---

## 4. Bonnes pratiques web

### WEB-01 — Accessibilité · **Moyenne**
- [ModalView.vue](../../src/components/Modals/ModalView.vue) : `aria-label="Modal dialog"` générique (utiliser `aria-labelledby` sur le titre), bouton `×` sans `aria-label`, `onUnmounted` qui refocus un élément même si la modale n'a jamais été ouverte.
- Burger menu ([App.vue:75](../../src/App.vue#L75)) sans `aria-label`, `aria-expanded` ni `aria-controls`.
- Plusieurs `<h1>` par page (header, landing, « Scheduled Toots ») ; `<main>` présent seulement sur la landing.
- Compteur de caractères sans `aria-live`, erreurs sans `role="alert"`.
- Cases « media / poll » sans label visible (icônes CSS) ; menu mobile ouvert sans gestion du focus ni fermeture via `Escape`.

### WEB-02 — Performance des polices · **Moyenne**
~1,3 Mo de TTF variables (Nunito 560 Ko ×2, Winky 105 Ko ×2) chargés au premier rendu, plus 16 TTF statiques versionnées inutilement. **Reco :** conversion WOFF2 et subset latin (gain estimé de 70 à 80 %), suppression des fichiers statiques non référencés.

### WEB-03 — Écouteurs d'activité non throttlés · **Moyenne**
`mousemove` réinitialise deux `setTimeout` à chaque pixel ([useSessionTimeout.ts:79](../../src/composables/useSessionTimeout.ts#L79)). **Reco :** throttle (`useThrottleFn` de @vueuse, déjà en dépendance) ou `useIdle`.

### WEB-04 — Script inline dans `index.html` · **Moyenne**
Ce script empêche une CSP `script-src 'self'`. **Reco :** le déplacer dans `public/spa-redirect.js`, ou gérer `?redirect=` dans le router avant le mount.

### WEB-05 — Pas de gestion d'erreur globale · **Basse**
Ni `app.config.errorHandler` ni `unhandledrejection` : une erreur de rendu donne un écran blanc.

### WEB-06 — Méta & SEO minimal · **Basse**
Pas de `<meta name="description">`, d'Open Graph ni de `theme-color`. Le `vite.svg` par défaut traîne encore dans `public/`.

### WEB-07 — Fuseau horaire implicite · **Basse**
La date et l'heure sont interprétées dans le fuseau du navigateur sans l'afficher. Pour un outil de planification, il faut **afficher le fuseau** (ex. « 14:00 Europe/Stockholm ») dans le composer et les cartes.

---

## 5. Clean code & outillage

### CC-01 — Le typecheck ne s'exécute pas : 5 erreurs masquées · **Critique**
`"build": "vue-tsc && vite build"` : sur un `tsconfig.json` de type solution (`files: []` + `references`), `vue-tsc` sans `-b` **ne vérifie rien**. `vue-tsc --noEmit -p tsconfig.app.json` remonte :
- [ScheduledToots.vue:118](../../src/components/Toot/ScheduledToots.vue#L118) : type `poll` incompatible avec `TootCard`.
- [ScheduledToots.vue:121](../../src/components/Toot/ScheduledToots.vue#L121) : `onEdit`/`onDelete` attendus en `Promise<void>`.
- `axios` importé inutilement ([useMastodonApi.ts:1](../../src/composables/useMastodonApi.ts#L1)), `props` inutilisé ([ContentWarning.vue:2](../../src/components/ContentWarning.vue#L2)), `from` inutilisé ([router/index.ts:33](../../src/router/index.ts#L33)).

**Reco :** `vue-tsc -b && vite build`, corriger les 5 erreurs.

### CC-02 — Aucun test, aucun linter, aucun gate CI · **Haute**
Pas de Vitest, d'ESLint ni de Prettier. Le déploiement part directement en production sur push `main`. **Reco :** Vitest + @vue/test-utils + happy-dom, ESLint (`eslint-plugin-vue`, `typescript-eslint`, règles `vue/no-v-html: error` et `no-console: warn`), job CI `lint → typecheck → test → audit` avant `deploy`.

### CC-03 — Construction du payload dupliquée · **Moyenne**
[TootComposer.vue:154-187](../../src/components/Toot/TootComposer.vue#L154-L187) : deux blocs identiques pour la création et l'édition. **Reco :** une fonction pure `buildScheduledToot(form): ScheduledToot` dans `utils/`, testée unitairement.

### CC-04 — Duplication de constantes · **Moyenne**
La liste des langues est dupliquée ([TootCard.vue:22](../../src/components/Toot/TootCard.vue#L22), [ControlsBar.vue:28](../../src/components/ControlsBar.vue#L28)), les scopes OAuth et le `redirect_uri` sont recopiés 3 fois, `5` minutes apparaît en double. **Reco :** `src/config/constants.ts`.

### CC-05 — Couche API incohérente · **Moyenne**
Un nouveau client axios est créé à chaque `useMastodonApi()`. `uploadMedia` contourne axios (XHR, alors qu'axios gère `onUploadProgress`), `auth.ts` appelle axios directement pour éviter une dépendance circulaire, et le traitement d'erreur varie d'une fonction à l'autre (certaines n'ont pas de `try`). **Reco :** un client unique (`baseURL`, interceptors req/resp), des fonctions API pures, aucune dépendance store → API → store.

### CC-06 — Conventions du projet non respectées · **Basse**
- `scheduledToots.ts` est un *options store*, alors que `vue3-codegen` impose le *setup store*.
- `useRouter()` est appelé dans le store auth ; `initializeFromStorage()` est un effet de bord à la création du store et entre en concurrence avec le guard du router.
- Types `any` (`media_attachments: any[]`, `payload: any`, `warningToast: any`, `handleApiError(error: any)`).

### CC-07 — Code mort et commentaires obsolètes · **Basse**
`APP_VERSION = '1.0.0'` est inutilisé et faux, `lastThreeNewFeatures` est mal nommé (il ne renvoie pas les « derniers »), le commentaire « For testing: 30 seconds » est obsolète, `{{ editingMediaIndex === index ? 'Alt' : 'Alt' }}`, les fonctions `handleShowMedia`/`handleShowPoll` font 6 lignes pour un toggle, et les JSDoc sont répétées dans les objets retournés.

### CC-08 — Dépendances inutilisées · **Basse**
`zod` (à utiliser, voir SEC-07), `@vueuse/components` jamais importé, `@vueuse/core` jamais importé.

### CC-09 — `JSON.parse` non protégé · **Basse**
[features.ts:265](../../src/stores/features.ts#L265) : une valeur corrompue dans `localStorage` fait planter le store au démarrage.

### CC-10 — Libellés UI trompeurs · **Basse**
« Editing… » / « Deleting… » s'affichent sur **toutes** les cartes pendant n'importe quel chargement ([TootCard.vue:83-90](../../src/components/Toot/TootCard.vue#L83-L90)).

---

## 6. Checklist `web-security` : état

| Contrôle | État |
|---|---|
| `v-html` / `innerHTML` | ✅ aucun |
| Données API rendues via `{{ }}` | ✅ |
| Token dans l'URL / query | ✅ jamais |
| Token loggué | ⚠️ pas le token, mais account et toots (SEC-09) |
| `localStorage` pour les secrets | ❌ (SEC-03) |
| Token validé au démarrage | ✅ (`verify_credentials`) |
| 401 géré partout | ❌ (SEC-06) |
| OAuth `state` | ❌ (SEC-02) |
| Scopes minimaux | ✅ `read:accounts read:statuses write:media write:statuses` |
| HTTPS imposé | ❌ (SEC-05) |
| `redirect_uri` depuis `window.location.origin` | ✅ |
| Upload : taille | ✅ 8 Mo · type ❌ au drop (SEC-11) |
| Longueur des inputs bornée | ⚠️ textarea oui ; CW, alt text et options de sondage non |
| CSP | ❌ (SEC-03 / WEB-04) |
| `.env` ignoré, `.env.example` présent | ✅ |
| `npm audit` propre | ❌ (SEC-01) |
| Réponses API validées | ❌ (SEC-07) |
| Listes bornées / paginées | ❌ (BUG-03) |

---

## 7. Points positifs

- Aucun rendu HTML brut, Composition API homogène, `<script setup lang="ts">` partout.
- `normalizeUrl` extrait bien l'`origin` (anti-injection de chemin), et le `redirect_uri` n'est jamais dérivé de l'input.
- Le token est revalidé au démarrage, avec un logout silencieux en cas d'échec.
- La modale possède un focus trap et gère `Escape`, la confirmation de suppression est in-app.
- La surface est réduite : pas de backend, aucune donnée stockée côté service.

**Statut :** CC-01, CC-02, SEC-01 et SEC-10 sont corrigés en 0.13.1 (Lot 0).

Le plan de remédiation priorisé est dans [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../superpowers/specs/2026-10-01-red-team-remediation-design.md).
