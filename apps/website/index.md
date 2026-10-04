---
layout: home

hero:
  name: DevHub
  text: 本地项目的脚本，一个窗口全管
  tagline: 自动识别 npm / Maven / Gradle / 自定义脚本，单个或批量启动、停止、看日志。支持 Windows 与 Linux。
  image:
    src: /logo.png
    alt: DevHub
  actions:
    - theme: brand
      text: 下载
      link: https://github.com/Delta1035/devhub/releases/latest
    - theme: alt
      text: 快速上手
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/Delta1035/devhub

features:
  - title: 自动识别脚本
    details: 读取 package.json 的 scripts（pnpm / yarn / npm）、Maven 与 Gradle 构建（含多模块），优先使用 mvnw / gradlew；识别不到的写进 .devhub.yaml。
  - title: 运行与日志
    details: 启动 / 停止 / 重启，停止时结束整棵进程树；每个运行一个可交互的终端标签页，支持搜索和可点击链接。
  - title: 端口与健康检查
    details: 从命令推断端口，启动前提示端口占用并指出占用进程；运行中显示启动中 / 就绪 / 无响应。
  - title: 批量任务
    details: 跨项目组合脚本，并行或串行启动；串行时可等待日志文字、端口可连接或 HTTP 返回成功后再启动下一步。
  - title: 工作区
    details: 指定代码目录，自动发现其中的项目，并随仓库的新增、删除保持同步。
  - title: 运行历史
    details: 每个脚本保留最近 20 次运行的结果与日志，重启 DevHub 后仍可查看。
---

<div class="vp-doc" style="max-width: 1152px; margin: 64px auto 0; padding: 0 24px">

![DevHub 主界面：项目列表、识别到的脚本与运行中的终端](../../docs/assets/main.png)

![批量任务：先启动后端，等它输出启动完成后再启动前端](../../docs/assets/batch.png)

</div>
