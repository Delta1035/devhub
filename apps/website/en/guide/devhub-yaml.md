# Custom scripts (`.devhub.yaml`)

When DevHub cannot detect a command — `docker compose`, a command with arguments, one module of a larger build, a Python mock server — describe it in a `.devhub.yaml` (or `.devhub.yml`) file in the project root. Commit it, and everyone on the team gets the same scripts.

```yaml
scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server
    description: Backend
    port: 8081
    health: /actuator/health
  db:
    command: docker compose up postgres
    cwd: deploy
    port: 5432
```

Custom scripts are listed first. Changes apply on refresh or when the window regains focus.

## Fields

| Field                | Required | Meaning                                                                                                            |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `command`            | yes      | The command to run, or one per platform (see below).                                                               |
| `cwd`                | no       | Working directory, relative to the project. It cannot point outside the project.                                   |
| `description`        | no       | Shown next to the script name.                                                                                     |
| `port`               | no       | Port the script listens on. Used to warn about port conflicts and for health checks.                               |
| `ports`              | no       | Several ports, e.g. `[8081, 8082]`. Use either `port` or `ports`.                                                  |
| `health`             | no       | An HTTP path, starting with `/`, that must answer 2xx for the script to count as ready. See below.                 |
| `portConflictPolicy` | no       | What to do on a port conflict: `error` (report it, the default) or `terminate` (stop the holder first). See below. |

Script names are up to 60 characters. Unknown keys are reported as errors rather than ignored, so a typo such as `comand` does not silently do nothing.

## Per-platform commands

```yaml
scripts:
  api:
    command:
      windows: mvnw.cmd spring-boot:run
      linux: ./mvnw spring-boot:run
```

A script with a command for only one platform is hidden on the other.

## Ports

When neither `port` nor `ports` is given, DevHub infers ports from the command (for example `--port 3000` or well-known tools). Write `port` when the inference is wrong or finds nothing; without a port, the script shows **running** but no health.

## Port conflicts

The default is `error`: report the conflict and do not start. In **Settings → Process → Port conflicts** you can choose to stop the holder before starting, or set `portConflictPolicy: terminate` on one script only:

```yaml
scripts:
  api:
    command: mvnw.cmd spring-boot:run
    port: 8081
    portConflictPolicy: terminate
```

A script's `error` / `terminate` overrides the global setting, for both single and batch starts. Automatic release applies only to ports explicitly declared with `port` / `ports` in `.devhub.yaml`; inferred ports still only report conflicts, so a tool's default port cannot stop an unrelated service. DevHub first stops managed services normally, then terminates external holders and their process trees, and waits for the ports to be free before starting. If a holder cannot be identified or stopped, startup fails with a reason.

## Health checks

By default a script is ready when all its ports accept connections. Opening a port does not always mean the application is ready, so for HTTP services you can name a health path:

```yaml
health: /actuator/health
```

DevHub then requests `http://localhost:<first port><path>` and counts the script as ready on a 2xx response. Redirects are not followed, so a redirect to a login page does not count. A `health` path needs a port, either written or inferred.

## Errors

Mistakes are shown in the script list: YAML syntax errors with their line number, invalid content with the field path (for example `scripts.api.command`). Scripts detected from `package.json`, Maven or Gradle are not affected.

## Security

Commands from `.devhub.yaml` are treated like `package.json` scripts: they run only when you click run.
