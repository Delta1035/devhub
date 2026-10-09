# Changelog

User-facing changes in each DevHub release. `pnpm release` generates each section from the
Conventional Commits since the previous tag (`scripts/changelog.mjs`), and the Release workflow
uses it as the GitHub Release notes.

## v1.5.0 - 2026-10-09

### Features

- **groups:** show which batch run is running (362b576)

### Fixes

- **desktop:** quit on SIGTERM when no scripts are running (#45) (28fb111)
- **remote:** retry a taken port at startup instead of giving up (#44) (eeb40e6)
- **mobile:** tell the user to upgrade an old desktop instead of blaming the network (#43) (2eb482f)

## v1.4.0 - 2026-10-07

### Features

- **mobile:** connect the Android app by scanning the desktop QR code (9888095)
- **mobile:** give the Android app the DevHub icon and launch screen (59b7bb2)
- **settings:** copy the whole connect link for the Android app (a1ba843)
- **mobile:** live-update the app's web bundle to match the desktop (d917e7a)
- **remote:** report the desktop's version in the remote session (343265a)
- **mobile:** package the web app as an Android app with Capacitor (e7fdfa6)
- **remote:** allow the Android app's origin through CORS (748e620)
- **mobile:** add the Expo Android client skeleton (0523043)
- make the web app installable and document HTTPS via tailscale serve (20d09d9)
- **renderer:** offer project actions behind a "more" button on touch screens (14b4928)
- **renderer:** fit the web app to phone-sized screens (4b0c507)
- **remote:** prefer LAN addresses and rank proxy TUN adapters last (8c3cc04)

### Performance

- **renderer:** load the terminal and settings on demand (983bab6)

## v1.3.0 - 2026-10-05

### Features

- **renderer:** run as the web app over the remote API (1d0d033)
- build the renderer as a web app and serve it from the remote server (81e19e1)
- **shared:** add the remote HTTP + SSE client and a session endpoint (387902c)
- configure remote access from settings, with a connection QR code (7fdb100)
- **core:** push core events to remote clients over SSE (2d89951)
- **core:** serve DevhubApi over an opt-in remote HTTP API (4e3ee5a)

### Fixes

- **website:** override VitePress's vite 5 to the patched 6.4.3 (ae7085b)
- **core:** resolve the user's environment for started processes (75ccf29)
- **core:** do not create remote.json while remote access is off (5abdc8c)

## v1.2.0 - 2026-10-05

### Features

- **desktop:** safer and richer project list interactions (885d581)
- **website:** make Chinese the primary language (18f07fc)
- **website:** add a bilingual VitePress site deployed to GitHub Pages (bf7040c)

### Fixes

- **desktop:** open project hover cards only under the pointer (4ea5a60)
- **website:** make Chinese search work and keep old /zh/ links alive (6cd6e24)

## v1.1.0 - 2026-10-04

### Features

- bundle per-style fonts and make run-state colors follow the style (9cbae30)
- add Nord, Yaru and Terminal design styles (27f8805)
- add switchable design styles (Neutral, Material 3, Fluent) (a2bd6a7)
- show workspaces in the sidebar, grouped and kept in sync (27e550e)
- discover and sync projects in workspace directories (core) (15e49d1)

## v1.0.0 - 2026-10-03

First stable release: the same app as v0.1.8, with an English README, license and contributing
guide.

## v0.1.8 - 2026-10-03

### Features

- preserve run history and logs across restarts (089543f)
- clarify batch runs and install paths for multi-project workflows (8604a39)

## v0.1.7 - 2026-10-03

### Features

- keep a history of how each script's runs ended (bb8baab)
- show whether running scripts are ready (health checks) (d2c439f)

## v0.1.6 - 2026-10-02

### Features

- replace system title bar with a custom one (7a481e6)
- combine projects and batch groups into sidebar tabs (65df013)

## v0.1.5 - 2026-10-02

No user-facing changes (development dependency updates).

## v0.1.4 - 2026-10-02

### Features

- update DevHub itself from GitHub Releases (6d3a260)
- custom shells with their own path and arguments (bff2ac5)
- regex output conditions and remembered group results (7441d69)
- custom scripts from a project's .devhub.yaml (dcce6a9)
- warn before starting a script whose port is taken (c8cd17d)
- add a settings page (89dba55)

### Fixes

- run mvnw / gradlew through sh when they are not executable (64bda4a)

## v0.1.3 - 2026-10-02

### Features

- offer to stop processes left behind by a crash (f5642ff)
- show which projects still have live terminals (5f47eeb)
- batch-run scripts across projects, in parallel or in sequence (3491c32)
- make the terminal a full interactive terminal (a7f8f36)
- open interactive terminals in a project (Git Bash by default) (ab68c00)
- open projects in VS Code or IntelliJ IDEA (756ea54)

### Fixes

- answer cmd's batch-job prompt so npm scripts stop in a second (a7a69f6)
- give the dev build its own userData (f3f146e)

## v0.1.2 - 2026-10-02

### Fixes

- add package metadata the Linux deb build requires (42e11df)

## v0.1.1 - 2026-10-02

### Features

- open terminal links with Ctrl+click, restrict to http(s) (eecf52c)
- stream run output to an xterm terminal panel (abf97a3)
- run, stop and restart scripts with process-tree cleanup (d3cd2b5)
- add DevHub app icon set with one-command generator (803d19f)
- list detected scripts in project detail view (28d7a76)
- add gradle script detector (9838338)
- add maven script detector (d07e9f2)
- add script detector interface and npm detector (94f99fe)
- add project registry with JSON persistence (68bd602)

### Fixes

- produce installers named devhub-* and drop dev files from the package (b0cf0be)
