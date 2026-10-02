# 0008 项目内自定义脚本：`.devhub.yaml`

- 状态：已采纳
- 日期：2026-10-02

## 背景

自动探测覆盖不到的命令（docker compose、多模块项目中某个子模块的启动、带特殊参数的命令、Python mock 服务等）需要一种手写方式。PRD M2 规划为项目内可选的 `.devhub.yaml`。

## 决策

- 项目根目录的 `.devhub.yaml`（或 `.devhub.yml`），由新的探测器 `detectors/config-detector.ts` 读取，脚本来源为 `custom`，id 为 `custom:<名称>`，在列表中排在最前。
- 格式（`packages/shared` 的 `projectConfigSchema`，严格模式：拼错的键会报错而不是被忽略）：

```yaml
scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server # 或按平台：{ windows: ..., linux: ... }
    cwd: server # 可选，相对项目目录，不能跳出项目
    description: 后端 # 可选
    port: 8081 # 可选；也可 ports: [..]；省略时从命令推断
```

- 只写了另一个平台命令的脚本在当前平台不显示。
- 文件写错时作为探测警告显示，并指出位置：YAML 语法错误给出行号，内容错误给出字段路径（如 `scripts.api.command`）。其他探测器不受影响。
- 每次扫描都重新读取文件，修改后刷新或切回窗口即生效。
- 安全：命令来自项目文件，与 `package.json` 的 scripts 同等对待——只有用户点击运行才执行；`cwd` 限制在项目目录内。

### 新依赖：`yaml` 2.9

主进程运行时依赖（`dependencies`）。无其他依赖、自带类型；解析错误带行列号，便于提示手写文件的错误位置。

## 备选与理由

- `js-yaml`：使用更广，但需要额外的 `@types/js-yaml`，错误信息不如 `yaml` 精确。
- JSON 配置文件：无需依赖，但不能写注释，手写体验差。
- 把自定义脚本存在 DevHub 本地：不能随仓库共享，换电脑要重配。
