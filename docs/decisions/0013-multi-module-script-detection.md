# 0013 — 静态识别多模块启动任务

- 状态：已接受
- 日期：2026-10-03

## 背景

DevHub 原先只查看项目根目录的构建文件，Gradle 子项目与 Maven 子模块的应用启动任务无法自动识别。用户已批准 Gradle、Maven 独立开发并统一集成；两者继续使用已有探测器接口，不增加依赖或执行构建工具来扫描任务。

## 决策

- Gradle 读取 `settings.gradle(.kts)` 中静态 `include`，读取子项目构建文件，生成带完整项目路径的 `:子项目:bootRun` / `:子项目:run`。使用根目录 wrapper，在根目录执行；端口从应用子项目读取。
- Maven 读取静态 `<modules>`，最多向下递归 3 层，应用模块分别提供「构建依赖」和「启动」脚本：`-pl <模块> -am install -DskipTests` 与 `-pl <模块> spring-boot:run`。首次启动或兄弟模块变化时先构建依赖，日常启动可直接运行第二条；不自动执行构建，不把 `-am` 与启动目标混用。
- 多项目 Gradle 根应用使用 `:bootRun` / `:run`，Maven 根应用含模块时使用 `-N`，避免根启动命令递归启动其他应用；`packaging=pom` 的聚合模块不提供启动脚本。Maven 可识别已扫描的直接本地父模块插件继承，尊重 `inherited=false`，不读取外部父 POM。
- 输入在探测器内校验；模块不得越出项目目录或把 shell 元字符带入命令。脚本 id 来自稳定的模块路径，扫描不改变工作目录。
- 仅识别静态声明；不计算 Gradle 代码、Maven effective POM、动态模块、插件别名或完整继承。未识别的应用可通过 `.devhub.yaml` 显式配置。

## 备选与理由

- 调用 Gradle / Maven 列举所有任务：更准确，但需要已安装的 Java、可能下载依赖或执行仓库代码，扫描耗时与副作用不适合窗口聚焦时自动重扫。
- 仅提供 Maven 启动脚本：首次运行可能因兄弟模块未安装而失败，用户难以找到准备步骤。增加独立构建脚本能明确说明操作与成本。
- 自动创建完整工作流或新增 Workspace：当前需求仅为补齐脚本探测，复用 Script、现有批量任务即可。

## 参考

- [Gradle 多项目构建](https://docs.gradle.org/current/userguide/multi_project_builds.html)
- [Maven 多模块与 Reactor](https://maven.apache.org/guides/mini/guide-multiple-modules.html)
- [Spring Boot Maven 启动目标](https://docs.spring.io/spring-boot/maven-plugin/run.html)
