# DevHub Preload 与 IPC 类型说明

本文面向第一次接触 Electron preload、IPC 和 DevHub API 的开发者。它解释当前代码为什么这样组织、一次调用是怎样流转的，以及后续可以怎样增强类型安全。

本文是学习和设计说明，不改变当前实现。当前 preload 的 `invoke` 类型优化方案暂不落地，后续可以按本文的建议单独建 issue 实施。

## 1. 先建立整体认识

DevHub 是一个 Electron 桌面应用，但界面和业务核心被刻意分开：

```text
renderer（React 界面）
    |
    | 只调用 @renderer/api
    v
preload（安全桥接层）
    |
    | ipcRenderer.invoke / contextBridge
    v
main/ipc.ts（IPC 路由）
    |
    v
core（业务核心，不依赖 Electron）
    |
    +--> 文件、进程、终端、设置、历史记录
```

同一套 core 还被远程 HTTP API 使用：

```text
PWA / Android
    |
    | HTTP + SSE
    v
core/remote/remote-server.ts
    |
    v
core（与桌面 IPC 使用同一个 DevhubApi）
```

因此 `DevhubApi` 不是单纯的 Electron IPC 类型，而是 UI 与业务核心之间的传输无关契约。桌面 IPC、远程 HTTP 和将来的其他客户端都应该实现它。

## 2. 当前代码各自负责什么

### `packages/shared/src/api.ts`

这里定义跨边界共享的 API 契约：

```ts
export interface DevhubApi {
  listProjects(): Promise<Project[]>
  addProject(path: string): Promise<Project>
  startScript(projectId: string, scriptId: string, options?: StartScriptOptions): Promise<Run>
}
```

它描述三件事：

- 方法名是什么；
- 参数的编译期类型是什么；
- 成功时返回什么类型。

它不负责运行时校验，也不直接实现业务逻辑。

同文件中的 `devhubApiMethods` 是运行时方法名清单：

```ts
export const devhubApiMethods = [
  'getAppInfo',
  'listProjects',
  'addProject'
  // ...
] as const satisfies readonly DevhubApiMethod[]
```

TypeScript 的接口在运行时会消失，因此动态注册 IPC handler 时必须额外保留这份字符串清单。`satisfies` 加上 `MissingMethods` 检查可以让新增 API 时不容易忘记更新清单。

### `apps/desktop/src/main/core/devhub-core.ts`

这里把各个业务服务组装成一个实现了 `DevhubApi` 的对象：

```ts
const api: DevhubApi = {
  listProjects: () => projects.list(),
  addProject: (path) => projects.add(path),
  startScript: (projectId, scriptId, options) => runs.startScript(projectId, scriptId, options)
}
```

`DevhubApi` 在这里发挥了实现检查作用。如果接口新增方法而 core 没有实现，编译就会失败。

core 不导入 Electron。这是重要边界：将来手机或其他客户端通过 HTTP 访问时，可以复用同一套业务逻辑。

### `apps/desktop/src/main/ipc.ts`

这里把 API 方法注册为 Electron IPC handler：

```ts
for (const method of devhubApiMethods) {
  const handler = core[method] as AnyApiMethod
  ipcMain.handle(ipcChannel(method), (_event, ...args: unknown[]) =>
    toIpcResult(method, () => handler(...args))
  )
}
```

例如：

```text
DevhubApi.addProject
    -> devhub:addProject
    -> ipcMain.handle('devhub:addProject', ...)
    -> core.addProject(...)
```

这里的 `unknown[]` 是有意出现的：IPC 收到的是运行时值，不能只相信 TypeScript。真正的输入校验由 core 服务完成。

### `apps/desktop/src/preload/index.ts`

preload 在 Electron 的隔离环境中运行。它有两个主要职责：

1. 通过 `ipcRenderer.invoke` 调用主进程；
2. 通过 `contextBridge.exposeInMainWorld` 只暴露允许 renderer 使用的 API。

```ts
contextBridge.exposeInMainWorld('devhub', api)
contextBridge.exposeInMainWorld('devhubEvents', events)
contextBridge.exposeInMainWorld('devhubShell', shell)
```

renderer 不应该直接 import `electron`，也不应该直接访问 `window.devhub`。项目规定 renderer 通过 `@renderer/api` 访问：

```ts
import { api } from '@renderer/api'

const projects = await api.listProjects()
await api.startScript(projectId, scriptId)
```

这样桌面端和远程网页端可以使用相同的 UI。桌面端的 `@renderer/api` 使用 preload，PWA/Android 则使用远程客户端。

### `apps/desktop/src/renderer/src/api/index.ts`

这里的 `declare global` 是 TypeScript 的 interface declaration merging：

```ts
declare global {
  interface Window {
    devhub?: DevhubApi
    devhubEvents?: DevhubEvents
    devhubShell?: ShellApi
  }
}
```

它只是告诉 TypeScript：某些运行环境中 `window` 可能有这些属性。它不会创建属性，也不会检查 preload 运行时实际暴露的对象。

`devhub` 是可选的，因为远程网页没有 Electron preload：

```ts
export const api: DevhubApi = window.devhub ?? remote!.client.api
```

### Electron 中的三个边界

理解下面三个上下文，有助于判断代码应该放在哪里：

| 上下文   | 主要代码               | 能力和风险                                                 |
| -------- | ---------------------- | ---------------------------------------------------------- |
| renderer | React、组件、hooks     | 处理界面；不应该直接访问 Node 或 Electron                  |
| preload  | `src/preload/index.ts` | 连接 renderer 和 main；可以使用受限 Electron API；是安全桥 |
| main     | `src/main/`            | 管理窗口、IPC、文件和进程；拥有更高权限                    |

`contextBridge` 的意义不是“让 renderer 直接获得主进程对象”，而是把精心挑选的函数复制成可调用的边界。renderer 只能调用暴露出来的方法，不能因为拿到了 `api` 就访问 `fs`、启动任意进程或构造任意 IPC channel。

项目的 ESLint 规则会强制这一点：renderer 只能通过 `@renderer/api` 访问 core，不能 import `electron`、Node 内置模块，也不能直接使用 `window.devhub`。

## 2.1 `invoke` 能传什么，不能传什么

`ipcRenderer.invoke` 和 `ipcMain.handle` 之间传递的是 Electron 可序列化的参数和返回值。普通对象、数组、字符串、数字、布尔值和 `null` 通常没有问题；函数、类实例、打开的文件句柄、PTY 等运行时资源不能当作普通 API 数据传递。

这也是为什么 DevHub 的 API 传递的是：

```ts
api.startScript(projectId, scriptId, options)
api.writeRunInput(runId, data)
```

而不是把 `ChildProcess`、PTY 对象或 renderer 的 callback 传给 main。进程和终端资源留在 main/core，renderer 只传 ID、文本和配置数据。

需要持续接收数据时，使用 `DevhubEvents` 订阅，而不是尝试把 callback 作为 `DevhubApi` 参数传过 IPC。

## 3. 一次真实调用的完整过程

以项目列表为例，界面调用：

```ts
const projects = await api.listProjects()
```

完整流程如下：

### 第一步：renderer 选择 API 实现

`@renderer/api` 根据环境选择实现：

- Electron 桌面端：`window.devhub`，来自 preload；
- 浏览器：`remote!.client.api`，使用 HTTP；
- Android Capacitor：同样使用远程 HTTP，只是连接信息和原生能力不同。

### 第二步：preload 生成 IPC channel

当前动态 API 方法大致等价于：

```ts
listProjects: (...args) => invoke(ipcChannel('listProjects'), ...args)
```

`ipcChannel('listProjects')` 返回：

```text
devhub:listProjects
```

### 第三步：Electron 把调用交给主进程

```ts
ipcRenderer.invoke('devhub:listProjects')
```

它是请求-响应模式，返回一个 Promise。它不是 HTTP，也不是事件订阅。

### 第四步：main 侧找到 handler

`main/ipc.ts` 之前已经注册：

```ts
ipcMain.handle('devhub:listProjects', ...)
```

handler 调用 core 的 `listProjects()`。

### 第五步：core 读取业务数据

core 可能读取 JSON 存储、扫描目录、访问进程管理器等。它返回 `Project[]`，或者抛出 `DevhubError`。

### 第六步：统一封装结果

主进程不会直接让 handler 抛错，而是包装成：

```ts
{ ok: true, value: projects }
```

或者：

```ts
{
  ok: false,
  error: {
    code: 'PROJECT_NOT_FOUND',
    message: '...'
  }
}
```

这个结构叫 result envelope。它同时被桌面 IPC 和远程 HTTP 使用。

### 第七步：preload 解包

preload 当前做两件事：

```ts
if (result.ok) return result.value
throw new Error(result.error.message)
```

需要注意：这里的 `as IpcResult<unknown>` 或未来的 `as IpcResult<ApiValue<M>>` 都只是 TypeScript 断言，不会在运行时验证对象。当前架构把 main 视为本地受控进程，并把真正的参数验证放在 core；如果将来 preload 需要面对不受信任的主进程、插件或可替换 transport，就应该增加 envelope schema，并按方法增加 payload schema。

另外，preload 当前只把 `error.message` 转成普通 `Error`，没有把 `error.code` 挂到 renderer 的异常对象上。对于展示错误这已经够用；如果 UI 以后需要根据 `PROJECT_NOT_FOUND`、`PORT_CONFLICT` 等 code 做不同处理，应设计一个带 `code` 的共享错误类型，而不是让界面匹配错误文本。

这样 renderer 得到的是正常的 `Project[]`，失败时得到普通 Error，而不会暴露 Electron handler 的额外错误前缀。

## 4. 为什么当前 `invoke` 类型比较弱

当前定义是：

```ts
async function invoke(channel: string, ...args: unknown[]): Promise<unknown>
```

这会丢失方法名和参数之间的关系。例如，TypeScript 看不到下面这些事实：

```text
addProject       -> [string] -> Project
startScript      -> [string, string, options?] -> Run
getAppInfo       -> [] -> AppInfo
```

于是动态构造 API 时只能使用：

```ts
;(...args: unknown[]) => Promise<unknown>
```

最后的 `as unknown as DevhubApi` 是一个较大的类型断言。它不是运行时转换，也不会检查对象是否真的符合接口。

## 5. 后续可采用的 TypeScript 方案

暂不修改当前实现时，可以先记住这个目标形态：

```ts
type ApiMethod = keyof DevhubApi
type ApiFunction = (...args: never[]) => Promise<unknown>

type ApiArgs<M extends ApiMethod> = Parameters<Extract<DevhubApi[M], ApiFunction>>

type ApiValue<M extends ApiMethod> = Awaited<ReturnType<Extract<DevhubApi[M], ApiFunction>>>

async function invoke<M extends ApiMethod>(
  channel: string,
  ...args: ApiArgs<M>
): Promise<ApiValue<M>> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<ApiValue<M>>

  if (result.ok) return result.value
  throw new Error(result.error.message)
}
```

然后通过方法工厂保留方法名的类型：

```ts
function createApiMethod<M extends ApiMethod>(method: M): DevhubApi[M] {
  return ((...args: ApiArgs<M>) => invoke<M>(ipcChannel(method), ...args)) as DevhubApi[M]
}
```

这个方案仍可能需要对 `Object.fromEntries` 做一次局部断言，因为标准库无法表达动态 entries 与 mapped type 的键值关联。但它把断言缩小到了动态对象构造处，不再让所有参数和返回值都变成 `unknown`。

## 6. 行业最佳实践：IPC 类型通常怎样设计

没有一种所有桌面框架都通用的写法，但成熟项目通常有以下共同点。

### 6.1 暴露能力，而不是暴露整个运行时对象

推荐：

```ts
contextBridge.exposeInMainWorld('devhub', {
  listProjects: () => ipcRenderer.invoke('devhub:listProjects'),
  addProject: (path: string) => ipcRenderer.invoke('devhub:addProject', path)
})
```

不推荐把 `ipcRenderer` 本身暴露给 renderer：

```ts
contextBridge.exposeInMainWorld('electron', { ipcRenderer })
```

后者等于让 renderer 自己构造任意 channel 和参数，安全边界会变得很模糊。

DevHub 当前的 `contextBridge` 设计是正确方向：只暴露 `DevhubApi`、`DevhubEvents` 和受限的 `ShellApi`。

### 6.2 API 契约集中维护

行业常见做法包括：

- shared TypeScript interface；
- OpenAPI / JSON Schema；
- protobuf / gRPC schema；
- Rust/TypeScript 类型生成；
- 手写接口加运行时 schema。

DevHub 采用的是 `packages/shared/src/api.ts` 的共享 TypeScript 契约，再配合 zod domain schema。这对当前 monorepo 很合适，因为桌面端和网页端都由 TypeScript 构建。

### 6.3 编译期类型和运行时校验分开

TypeScript 只保护已编译的代码。IPC、HTTP、文件、命令输出都可能携带运行时数据，因此不能只依赖 interface：

```text
TypeScript interface
  -> 约束开发者写代码

zod schema
  -> 检查运行时收到的数据
```

DevHub 当前在 core 使用 zod 校验来自 renderer、配置文件和外部进程的输入，这是正确的边界位置。preload 可以恢复静态类型，但不能取代 core 的 zod 校验。

### 6.4 请求-响应和事件推送分开

函数调用适合：

```ts
await api.listProjects()
```

持续变化适合订阅：

```ts
const unsubscribe = events.subscribe((event) => {
  // run-updated、run-output、settings-updated 等
})
```

DevHub 没有把回调塞进 `DevhubApi`，而是把 `DevhubEvents` 单独处理。这一点很重要：IPC 自动映射适合请求-响应，不适合把 callback 当普通 JSON 参数传递。

## 7. Tauri 是怎样写的

Tauri 的常见调用模型是 Rust command + JavaScript `invoke`。

Rust 侧通常写成：

```rust
#[tauri::command]
fn greet(name: String) -> Result<String, String> {
    Ok(format!("Hello, {name}!"))
}

tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

前端调用：

```ts
import { invoke } from '@tauri-apps/api/core'

const message = await invoke<string>('greet', { name: 'DevHub' })
```

这里有两个容易误解的地方。

### Rust 强类型不等于前端自动获得类型

Rust 编译器知道：

```rust
fn greet(name: String) -> Result<String, String>
```

它可以检查 Rust 内部调用是否正确，也可以通过 serde 在运行时反序列化参数。

但是普通的 JavaScript：

```ts
invoke('greet', { name: 'DevHub' })
```

并不会因为 Rust 函数强类型就自动获得 TypeScript 类型。默认的 Tauri `invoke` 通常仍需要调用方提供返回值泛型，或者手动封装：

```ts
export const greet = (name: string) => invoke<string>('greet', { name })
```

### Tauri 常见的类型增强方式

Tauri 项目通常有几种选择：

1. 手写前端 wrapper：每个 command 对应一个 TypeScript 函数。
2. 使用 `serde` / `specta` / `tauri-specta` 等方案，从 Rust 类型生成 TypeScript 类型或客户端绑定。
3. 使用 OpenAPI、JSON Schema 或 protobuf，让 Rust 和前端都消费同一份 schema。
4. 只使用 Rust 的运行时反序列化，前端自行维护调用类型。

以 `tauri-specta` 一类方案为例，目标不是让 TypeScript 直接理解 Rust，而是：

```text
Rust command 类型
    -> 构建阶段生成 TypeScript 类型 / wrapper
    -> 前端使用生成的客户端
```

这和 DevHub 当前的目标非常接近：

```text
DevhubApi
    -> preload 自动生成桥接函数
    -> renderer 使用 @renderer/api
```

差异在于 DevHub 当前以 TypeScript interface 作为契约，而 Tauri 项目更可能以 Rust struct、enum、Result 和 serde 属性作为契约源。

## 8. Electron 和 Tauri 的主要差异

| 方面         | DevHub Electron                       | Tauri 常见方式                            |
| ------------ | ------------------------------------- | ----------------------------------------- |
| 业务核心     | TypeScript main/core                  | Rust command / Rust service               |
| IPC 注册     | `ipcMain.handle`                      | `#[tauri::command]` + `generate_handler!` |
| 前端调用     | preload 自己封装 `ipcRenderer.invoke` | `invoke('command', args)`                 |
| 类型来源     | shared `DevhubApi`                    | Rust 类型、serde，或生成绑定              |
| 运行时校验   | core 中使用 zod                       | Rust serde 反序列化，必要时额外校验       |
| 暴露方式     | `contextBridge` 暴露白名单 API        | Tauri command 白名单/调用机制             |
| 事件         | Electron channel + preload listener   | Tauri event API                           |
| 类型自动同步 | 当前有方法清单同步，参数仍较弱        | 不使用生成工具时前端也可能较弱            |

Rust 的优势是 command 实现本身有更强的静态约束，尤其是结构体、枚举、错误类型和序列化边界。但跨语言调用仍然需要 schema 或代码生成，否则前端还是可能把错误的参数传给 `invoke`。

## 9. zod 在 DevHub 中的位置

项目已经使用了比较清晰的分层。

### 领域数据

例如 `packages/shared/src/domain.ts`：

```ts
export const scriptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: scriptSourceSchema,
  command: z.string().min(1)
})

export type Script = z.infer<typeof scriptSchema>
```

这里 schema 同时提供：

- 运行时解析能力；
- 从 schema 推导的 TypeScript 类型。

### core 输入

例如项目服务接收 IPC 参数时使用：

```ts
const idInput = z.string().min(1)

async get(rawId: unknown) {
  const parsed = idInput.safeParse(rawId)
  if (!parsed.success) {
    throw new DevhubError('PROJECT_NOT_FOUND', '...')
  }
}
```

这里的 `rawId: unknown` 很有价值：它提醒实现者不要假设 transport 已经帮忙校验过。

### 文件和外部进程输出

配置文件、`package.json`、端口检测命令和历史数据也使用 schema 校验。这些数据不应该直接当作可信的 TypeScript 对象使用。

### 不建议立即在 preload 全量增加 zod

如果只是在 preload 对 `IpcResult<unknown>` 做 schema 校验，最多能确认 envelope 的形状，不能知道 `value` 是 `Project[]` 还是 `Run`。要完整校验必须建立每个 API 的返回 schema 映射，会增加维护成本。

当前更合适的策略是：

```text
preload：恢复编译期类型、解包错误
main/core：校验所有外部输入
shared schema：校验领域对象、配置和持久化数据
remote server：校验 HTTP 请求结构、权限和大小
```

## 10. 当前代码的实际使用场景

### 场景一：用户点击“启动脚本”

```text
React 按钮
  -> api.startScript(projectId, scriptId)
  -> desktop preload
  -> devhub:startScript
  -> main/ipc.ts
  -> core/run-manager.ts
  -> 创建子进程 / PTY
  -> 返回 Run
  -> DevhubEvents 推送 run-updated、run-output
  -> React 更新终端和运行状态
```

调用结果只适合表示“启动请求是否成功”。后续日志和状态变化由事件系统推送，而不是让 `startScript()` 一直等待进程结束。

### 场景二：用户发送终端输入

```ts
await api.writeRunInput(runId, data)
```

这会经过 IPC 到 core，再写入对应 PTY。它是高风险能力，因此不能把整个 `ipcRenderer` 暴露给 renderer，也不能只依赖前端按钮是否隐藏。core 必须继续校验 runId 和运行状态。

### 场景三：手机访问桌面端

手机页面仍然调用：

```ts
await api.listProjects()
```

但 `api` 的具体实现已经不是 preload，而是 `createRemoteClient`。远程 server 使用相同的 `DevhubApi` 方法名和 `IpcResult` envelope。

这就是为什么 `DevhubApi` 要放在 shared，而不是直接写在 Electron preload 文件里。

## 11. 给后续开发的判断标准

新增一个普通业务方法时，推荐顺序是：

1. 在 `packages/shared/src/api.ts` 添加 `DevhubApi` 方法。
2. 添加到 `devhubApiMethods`。
3. 在 core 服务中实现并为输入添加 zod 校验。
4. 在 `devhub-core.ts` 组装实现。
5. 通过现有自动 IPC / HTTP 映射暴露。
6. 在 renderer 的 `@renderer/api` 后使用，不直接访问 preload。
7. 如果是持续变化的数据，额外设计事件，而不是让请求长期挂起。
8. 为 core 逻辑写单元测试；涉及 IPC/preload 时运行 E2E。

新增本机能力时，例如原生文件选择器、窗口控制、自动更新，不要直接加入远程共享的 `DevhubApi`。应放到 `ShellApi`，因为它们只在桌面主机有意义。

## 12. 初学者排查 IPC 问题的方法

遇到按钮点击后没有结果时，建议按调用链从前往后检查，不要一开始就猜 preload 类型：

1. 在 renderer 确认是否真的调用了 `@renderer/api` 方法，参数值是否正确。
2. 在 `apps/desktop/src/preload/index.ts` 确认是否生成了预期 channel，例如 `devhub:listProjects`。
3. 在 `apps/desktop/src/main/ipc.ts` 确认 `devhubApiMethods` 是否包含方法，以及 handler 是否被注册。
4. 在 core 服务入口确认 zod 校验是否失败，或者是否抛出了 `DevhubError`。
5. 在 `api-result.ts` 查看失败是否被包装成 `{ ok: false, error }`。
6. 如果请求成功但界面没有变化，检查是返回值问题还是 `DevhubEvents` 没有订阅/处理。

可以把一次调用分成两个问题来分析：

```text
请求有没有到达？
  renderer -> preload -> IPC handler -> core

结果有没有回到界面？
  core -> IpcResult -> preload 解包 -> Promise / event -> renderer
```

常见误区包括：

- 把 `DevhubApi` interface 当成运行时校验；它编译后不存在。
- 看到 `unknown` 就在 preload 强制断言，而没有在 core 校验输入。
- 把实时日志当成 `startScript()` 的返回值；启动结果和输出事件是两条路径。
- 直接从组件访问 `window.devhub`；这会绕过桌面/远程双实现，也违反项目边界。
- 为了修复类型错误把整个 `ipcRenderer` 暴露给 renderer；这会扩大权限，而不是解决契约问题。

## 13. 结论

当前 DevHub 的总体架构是合理的：

- `DevhubApi` 是跨传输层的业务契约；
- preload 是 Electron 安全桥，不是业务层；
- `main/ipc.ts` 是请求路由和结果封装层；
- core 是真正的输入校验和业务执行边界；
- zod 负责运行时可信度，TypeScript interface 负责开发期契约；
- `DevhubEvents` 与请求 API 分离，适合实时日志和状态变化；
- 当前最明显的技术债是 preload 动态 API 构造时参数和返回值退化成 `unknown`。

后续如果优化类型，优先考虑“泛型 `invoke` + 方法工厂 + 局部断言”。如果未来希望达到 Tauri 生态中更强的跨语言同步效果，再考虑以 schema 或代码生成作为唯一契约来源，而不是同时手写多套接口。
