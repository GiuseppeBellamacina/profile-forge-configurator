# profile-forge configurator

The web configurator for [profile-forge](https://github.com/GiuseppeBellamacina/profile-forge): **https://giuseppebellamacina.github.io/profile-forge-configurator/**

Design your card with a live preview, then publish everything to your profile repo in one click. React + TypeScript + Vite, built to a static site.

- **Guided steps**: *Start* (preset, data, general) → *Look* (themes, colors) → *Layout* → *Details* (every section's options) → *Content* (about, projects, links, tech stack) → *Publish*. The preview stays visible; on a phone it is a bottom sheet.
- **Live preview** with the real renderer (`profile-forge/src/render.js` is bundled into the page), dark/light slots, demo data or your own numbers.
- **Theme gallery** with a preview of each of the 47 themes, custom themes, per-color overrides.
- **Presets gallery**, undo / redo (Ctrl Z / Ctrl Y), a search box for any option (Ctrl K), a dot and a reset button on every field that differs from the default.
- **Share a configuration** as a link (`#c=…`, no server) or import / export `config.json`.
- **One-click publish**: `config.json`, `.github/workflows/profile-forge.yml`, the icons under `assets/img/` and the card block in `README.md` go into your `<login>/<login>` repo in a single commit. It can create the repo, shows which files are new / changed, and starts the first workflow run.
- **No token?** Download a `.zip` of everything, or open pre-filled “new file” pages on github.com.

## Hosting (GitHub Pages)

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs on every push to `main`: it checks out [profile-forge](https://github.com/GiuseppeBellamacina/profile-forge) next to this repo (so the page always runs the same renderer, themes, fonts, presets and schema as the GitHub Action), runs the tests, builds with Vite and deploys `dist/`. Run it by hand to build against another profile-forge branch or tag (`core_ref` input).

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
   - Homepage URL: `https://<owner>.github.io/profile-forge-configurator/`
   - Authorization callback URL: `https://<your-worker>.workers.dev/auth/callback` (exactly: the worker builds `redirect_uri` from its own origin).
2. Deploy the worker (needs a free Cloudflare account):

   ```bash
   cd worker
   # edit wrangler.toml: GITHUB_CLIENT_ID and ALLOWED_ORIGINS (origins of your Pages site, and of local dev)
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler deploy
   ```
3. In **this** repo, **Settings → Secrets and variables → Actions → Variables**, add `AUTH_URL` = `https://<your-worker>.workers.dev`, then re-run the Pages workflow. The URL is baked into the page at build time (`VITE_AUTH_URL`).

Without `AUTH_URL` the page falls back to a personal access token (classic: `repo` + `workflow`, or fine-grained with Contents and Workflows write). Either way the token lives in this tab's session storage only and is sent only to `api.github.com`.

`ALLOWED_ORIGINS` compares origins only (scheme + host + port), so it doesn't care about the `/profile-forge-configurator/` path. The dev server uses port **8080**, which is already in the list.

## Your real profile in the preview

After signing in, your profile is fetched **once** (a few seconds) and cached for the tab; every edit re-renders from that data. The only option that fetches again is `includePrivate` (once per value). You can also preview any other public login. `streak.startingYear` is applied to the loaded data without a refetch.

## Development

```bash
git clone https://github.com/GiuseppeBellamacina/profile-forge      # the renderer lives there
git clone https://github.com/GiuseppeBellamacina/profile-forge-configurator
cd profile-forge-configurator
npm install
npm run dev          # http://localhost:8080  (CORE_DIR=path to use another profile-forge checkout)
npm test             # worker tests (node:test) + unit tests (vitest)
npm run build        # typecheck + production build into dist/
```

`scripts/sync-core.js` copies the files the page fetches at runtime (fonts, presets, theme and preset preview images) from the profile-forge checkout into `public/core/` (git-ignored). The renderer itself is imported through the `@core` alias (`vite.config.ts`). Open a step directly with `?step=look` (`start`, `look`, `layout`, `sections`, `content`, `publish`).

### Where to change things

```
src/schema/fields.ts          every simple option as data: label, hint, type, options, step.
                              The forms, the search box, the "modified" dots and the reset buttons all read it.
src/core.ts                   the only file that touches profile-forge's JS (typed facade)
src/store/config.ts           the config being edited: setVal (drops defaults), undo / redo, persistence
src/store/session.ts          GitHub sign-in and the profile used by the preview
src/store/ui.ts               wizard steps, selected slot, search
src/hooks/usePreview.ts       config → card SVG (debounced)
src/components/steps/         one component per wizard step
src/components/editors/       themes, layout, presets, content, publish…
src/components/ui/Fields.tsx  generic field controls
src/lib/                      publish (GitHub REST + generated files), zip, share links, demo data
src/styles/app.css            design tokens (colors, radius) at the top
worker/index.js               OAuth backend (Cloudflare Worker)
```

To add an option profile-forge just gained: add one entry to `src/schema/fields.ts`. A test fails if the entry doesn't match what `config.js` accepts.

MIT, see [LICENSE](LICENSE).
