# profile-forge configurator

The web configurator for [profile-forge](https://github.com/GiuseppeBellamacina/profile-forge): **https://giuseppebellamacina.github.io/profile-forge-configurator/**

An interactive page for designing your card with a live preview, then publishing everything to your profile repo:

- **Live preview** of the real renderer (`src/render.js` runs in the browser), dark/light slots, demo data or your own numbers.
- **Every option** of `config.json`: layout editor, themes, custom themes, color pickers, all section options, content (about, projects, links), tech stack with icons from [devicon](https://devicon.dev).
- **Presets** to start from, import of an existing `config.json`, copy / download of the result.
- **One-click publish**: `config.json`, `.github/workflows/profile-forge.yml`, the icons under `assets/img/` and the card block in `README.md` go into your `<login>/<login>` repo in a single commit. It can create the repo, shows which files are new / changed, and starts the first workflow run.
- **No token?** Download a `.zip` of everything, or open pre-filled “new file” pages on github.com.

## Hosting (GitHub Pages)

The site is deployed by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`. The workflow checks out [profile-forge](https://github.com/GiuseppeBellamacina/profile-forge) next to this repo, so the page always runs the same renderer, themes, fonts, presets and schema as the GitHub Action. Run it by hand to build against another profile-forge branch or tag (`core_ref` input).

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main` (or run the workflow manually). The URL is `https://<owner>.github.io/profile-forge-configurator/`.

## Signing in (OAuth backend)

A static page can't keep an OAuth client secret, so sign-in goes through a tiny backend, [`worker/index.js`](worker/index.js) (a Cloudflare Worker, free tier is plenty). It only does the code→token exchange; the token is handed back to the page in the URL *fragment* (never sent to any server) and the worker stores nothing.

```
page ──▶ worker /auth/login ──▶ github.com (approve) ──▶ worker /auth/callback ──▶ page#pf_token=…
```

It uses a full-page redirect instead of a popup, so it works on phones. Your edits are saved in the browser before the redirect and restored on return.

Scopes: `public_repo` + `workflow` by default (enough for a public profile repo). The *“Also read my private contributions”* checkbox asks for `repo` instead. Disconnecting revokes the grant.

### Setting it up once

1. Create an OAuth App: **GitHub → Settings → Developer settings → OAuth Apps → New**.
   - Homepage URL: `https://<owner>.github.io/profile-forge/`
   - Authorization callback URL: `https://<your-worker>.workers.dev/auth/callback`
2. Deploy the worker (needs a free Cloudflare account):

   ```bash
   cd worker
   # edit wrangler.toml: GITHUB_CLIENT_ID and ALLOWED_ORIGINS (the origin of your Pages site)
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler deploy
   ```
3. In **this** repo, **Settings → Secrets and variables → Actions → Variables**, add `AUTH_URL` = `https://<your-worker>.workers.dev`, then re-run the Pages workflow. It writes the URL into `config.js`.

Without `AUTH_URL` the page falls back to a personal access token (classic: `repo` + `workflow`, or fine-grained with Contents and Workflows write). Either way the token lives in this tab's session storage only and is sent only to `api.github.com`.

`npm test` covers the worker (state check, return-origin allow-list, token exchange, revoke).

## Your real profile in the preview

After signing in, your profile is fetched **once** (a few seconds) and cached for the tab; every edit re-renders from that data. The only option that fetches again is `includePrivate` (once per value). You can also preview any other public login. `streak.startingYear` is applied to the loaded data without a refetch.

## Local development

```bash
git clone https://github.com/GiuseppeBellamacina/profile-forge      # the renderer lives there
git clone https://github.com/GiuseppeBellamacina/profile-forge-configurator
cd profile-forge-configurator
npm run serve        # builds _site/ and serves http://localhost:8080  (CORE_DIR=path to use another profile-forge checkout)
npm test             # OAuth worker tests
```

`scripts/build-site.js` copies `site/` plus `src/`, `fonts/`, `presets/` and the schema from the profile-forge checkout into `_site/`.

```
site/index.html, style.css   page shell
site/app.js                  UI: editors, preview, publish flow
worker/index.js              OAuth backend (Cloudflare Worker)
site/config.js               AUTH_URL (written by the Pages workflow)
site/publish.js              workflow / README generators + GitHub REST client (single commit via the git data API)
site/zip.js                  tiny zip writer
site/demo-data.js            demo profile for the preview
```

MIT, see [LICENSE](LICENSE).
