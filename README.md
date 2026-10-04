<div align="center">

<img src="apps/desktop/build/icon.png" alt="DevHub" width="96" height="96" />

# DevHub

One place to run the scripts of all your local projects: detects npm / Maven / Gradle / custom scripts, then starts, stops and tails them — individually or in batches.

**English** · [简体中文](README.zh-CN.md)

[![CI](https://github.com/Delta1035/devhub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Delta1035/devhub/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Delta1035/devhub?sort=semver)](https://github.com/Delta1035/devhub/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Delta1035/devhub/total)](https://github.com/Delta1035/devhub/releases)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-informational)
[![License](https://img.shields.io/github/license/Delta1035/devhub)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)

[Website](https://delta1035.github.io/devhub/en/) · [Download](https://github.com/Delta1035/devhub/releases/latest) · [Features](#features) · [Usage](#usage) · [Development](#development) · [Contributing](CONTRIBUTING.md)

</div>

When a frontend, a backend and a mock server all need to be running, you no longer need a terminal window per project or to remember how each one starts.

Runs on Windows and Linux (Ubuntu / X11). The UI is currently in Chinese.

![DevHub main window: project list, detected scripts and a running terminal](docs/assets/main.png)

## Features

- **Script detection**
  - npm: reads `package.json` scripts and picks pnpm / yarn / npm from the `packageManager` field or the lockfile; monorepo packages inherit the repository root's package manager
  - Maven: common lifecycle goals, plus `spring-boot:run` for Spring Boot projects; multi-module builds get a start command per application module
  - Gradle: `clean` / `build` / `test`, plus `bootRun` / `run` depending on plugins; multi-project builds are supported
  - Project wrappers (`mvnw` / `gradlew`) are preferred
  - Anything else goes in [`.devhub.yaml`](#custom-scripts-devhubyaml)
- **Runs and logs**: start / stop / restart, stopping the whole process tree; one terminal tab per run with interactive input, search, copy/paste and clickable links
- **Ports and health checks**: infers ports from commands, warns before starting when a port is taken and names the process holding it; running scripts show starting / ready / unresponsive
- **Batch tasks**: combine scripts across projects and start them in parallel or in sequence; a sequential step can wait for a successful exit, a text (or regex) in the output, an open port, an HTTP 2xx or a fixed delay, and a failure stops the remaining steps with a reason
- **Run history**: the last 20 runs of each script, with their logs, survive a DevHub restart
- **Project terminals**: open bash / PowerShell / cmd or a custom shell in the project directory
- **Also**: open projects in VS Code / IntelliJ IDEA, tray icon, light and dark themes, auto-update

## Install

Download from [Releases](https://github.com/Delta1035/devhub/releases):

| Platform | File                                                     |
| -------- | -------------------------------------------------------- |
| Windows  | `devhub-*-setup.exe` (installer, lets you pick a folder) |
| Linux    | `.AppImage` (auto-updates) or `.deb`                     |

The installers are not code-signed, so Windows SmartScreen warns on first launch; choose "More info → Run anyway".

Verify downloads with `SHA256SUMS.txt`, or check their build provenance:

```bash
gh attestation verify <file> --repo Delta1035/devhub
```

## Usage

1. Add a project folder under **项目** (Projects) in the sidebar; its scripts are listed on the right.
2. Click a script's run button. Output appears in the terminal panel below; the script row shows its port and health, and the history button lists earlier runs.
3. To start several services together, create a task under **批量** (Batch) and choose the scripts and their order.

![A batch task: start the backend, wait until it reports it has started, then start the frontend](docs/assets/batch.png)

Closing the window keeps DevHub in the tray with scripts still running; quitting DevHub stops every run. Settings can make closing the window quit instead.

### Custom scripts (`.devhub.yaml`)

Create `.devhub.yaml` in the project root for commands DevHub cannot detect (docker compose, commands with arguments, submodules…):

```yaml
scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server # or per platform: { windows: ..., linux: ... }
    cwd: server # optional, relative to the project; cannot leave it
    description: Backend # optional
    port: 8081 # optional, or ports: [8081, 8082]; inferred from the command when omitted
    health: /actuator/health # optional; readiness then means this path returns HTTP 2xx
```

Changes apply on refresh or when the window regains focus; mistakes are reported in the script list with a line number or field path.

## Development

Requires Node.js ≥ 22 and pnpm 11.

```bash
pnpm install
pnpm dev      # run the desktop app with hot reload
pnpm check    # format + lint + types + tests
pnpm e2e      # build, then drive the real app with Playwright
```

See [Contributing](CONTRIBUTING.md) for the project layout, conventions, commit style and release process. Design documents in `docs/` are written in Chinese.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Delta1035/devhub&type=Date)](https://star-history.com/#Delta1035/devhub&Date)

## License

[MIT](LICENSE)
