# 0002 本地持久化：JSON 文件

- 状态：已采纳
- 日期：2026-10-02

## 背景

需要持久化项目列表，后续还有 Profile、设置、运行历史。单用户、单进程（有单实例锁），数据量小（几十个项目）。

## 决策

使用 zod 校验的 JSON 文件，存放在 Electron `userData` 目录（Windows: `%APPDATA%\DevHub`，Linux: `~/.config/DevHub`）。

- 通用模块 `core/storage/json-store.ts`：读取时校验；文件损坏则备份为 `<file>.corrupt-<时间戳>` 并以空数据启动；写入采用「临时文件 + rename」保证原子性。
- 每个文件带 `version` 字段，为将来的格式迁移留口子。
- 各服务内存缓存数据，并串行化「读-改-写」，避免并发更新丢失。

## 备选与理由

- SQLite（better-sqlite3）：查询能力强，但需要原生模块编译、增加打包复杂度；当前数据量用不上。
- 运行历史/日志若将来需要按时间查询，再评估 SQLite，届时新增 ADR。
- JSON 可以直接打开查看和手工修改，便于调试。
