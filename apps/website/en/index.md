---
layout: home

hero:
  name: DevHub
  text: All your local scripts, one window
  tagline: Detects npm / Maven / Gradle / custom scripts, then starts, stops and tails them — individually or in batches. For Windows and Linux.
  image:
    src: /logo.png
    alt: DevHub
  actions:
    - theme: brand
      text: Download
      link: https://github.com/Delta1035/devhub/releases/latest
    - theme: alt
      text: Get started
      link: /en/guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/Delta1035/devhub

features:
  - title: Script detection
    details: Reads package.json scripts (pnpm / yarn / npm), Maven and Gradle builds including multi-module ones, and prefers mvnw / gradlew. Anything else goes in .devhub.yaml.
  - title: Runs and logs
    details: Start, stop and restart; stopping kills the whole process tree. Each run gets an interactive terminal tab with search and clickable links.
  - title: Ports and health
    details: Infers ports from commands, warns when a port is taken and names the process holding it, and shows starting / ready / unresponsive.
  - title: Batch tasks
    details: Combine scripts across projects and start them in parallel or in sequence, waiting for a log line, an open port or an HTTP 2xx before the next step.
  - title: Workspaces
    details: Point DevHub at your code folder and it finds the projects inside, keeping the list in sync as repositories come and go.
  - title: Run history
    details: The last 20 runs of each script, with their logs, survive a DevHub restart.
---

<div class="vp-doc" style="max-width: 1152px; margin: 64px auto 0; padding: 0 24px">

![DevHub main window: project list, detected scripts and a running terminal](../../../docs/assets/main.png)

![A batch task: start the backend, wait until it reports it has started, then start the frontend](../../../docs/assets/batch.png)

</div>
