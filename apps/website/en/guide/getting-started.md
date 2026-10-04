# Getting started

DevHub runs on Windows and Linux (Ubuntu / X11). The interface is currently in Chinese; this guide gives the English meaning next to each label.

## Install

Download the latest version from [GitHub Releases](https://github.com/Delta1035/devhub/releases/latest):

| Platform | File                                                     |
| -------- | -------------------------------------------------------- |
| Windows  | `devhub-*-setup.exe` (installer, lets you pick a folder) |
| Linux    | `.AppImage` (auto-updates) or `.deb`                     |

The installers are not code-signed, so Windows SmartScreen warns on first launch; choose **More info → Run anyway**.

To verify a download, compare it with `SHA256SUMS.txt` from the same release, or check its build provenance with the GitHub CLI:

```bash
gh attestation verify <file> --repo Delta1035/devhub
```

## Add projects

There are two ways to add projects, both from the **添加** (Add) button in the sidebar:

- **A single project**: pick a project folder. Its scripts are listed on the right.
- **A workspace** (**添加工作区**): pick a folder that contains many repositories. DevHub finds the projects inside — any folder with `package.json`, `pom.xml`, `build.gradle(.kts)`, `settings.gradle(.kts)` or `.devhub.yaml` — and keeps the list in sync: new repositories are added when you rescan or switch back to the window. By default only direct subfolders are scanned; the workspace settings allow 1 to 5 levels.

Removing a project that belongs to a workspace excludes it from later scans; you can restore it in the workspace settings. A project whose folder disappears is kept and marked as missing, so switching branches or unplugging a drive does not wipe its history.

## Run scripts

1. Click a script's run button. Its output appears in a terminal tab in the panel below, where you can type input, search and click links.
2. The script row shows the port the script uses and its health:
   - **starting** until its ports accept connections (or its [health path](./devhub-yaml#health-checks) answers 2xx),
   - **ready** while checks pass,
   - **unresponsive** after three failed checks in a row.
3. Stopping a script ends its whole process tree, including servers started by a wrapper such as `mvnw` or `pnpm`.
4. The history button lists the last 20 runs of the script, with their logs.

If a port is already taken when you start a script, DevHub tells you which process holds it before starting.

DevHub also detects:

- **npm**: `package.json` scripts, run with pnpm / yarn / npm according to the `packageManager` field or the lockfile; packages in a monorepo inherit the root's package manager.
- **Maven**: common lifecycle goals, plus `spring-boot:run` for Spring Boot; multi-module builds get a start command per application module.
- **Gradle**: `clean` / `build` / `test`, plus `bootRun` / `run` depending on plugins; multi-project builds are supported.

Commands it cannot detect go in [`.devhub.yaml`](./devhub-yaml).

## Tray and quitting

Closing the window keeps DevHub in the tray with scripts still running; quitting DevHub stops every run. Settings can make closing the window quit instead.

## Updates

The Windows installer and the Linux AppImage update themselves from GitHub Releases. The `.deb` package does not; install the new version manually.
