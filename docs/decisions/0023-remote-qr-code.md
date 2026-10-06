# 0023 远程连接二维码：uqr 与连接地址格式

- 状态：已采纳
- 日期：2026-10-05
- Issue：#15

## 背景

开启远程访问（ADR 0022）后，手机需要拿到地址、端口与 43 个字符的 Token。在手机上手动输入很容易出错，用户要求设置页显示二维码，扫码即可连接。

## 决策

- 引入 **uqr 0.1.3**（unjs，MIT，零依赖，自带类型，约 79 KB），放在 desktop 的 `devDependencies`，只打包进 renderer。只用 `encode()` 得到黑白矩阵，由 React 绘制 `<svg>`，不使用库生成的 SVG 字符串（避免 `dangerouslySetInnerHTML`）。
- 连接地址格式（shared `remoteConnectUrl`）：`http://<地址>:<端口>/#token=<Token>`，IPv6 地址加方括号。
  - Token 放在 `#` 之后：浏览器不会把片段发给服务器，也不会进入访问日志或 Referer。
  - PWA 将由同一服务在 `/` 托管（#18），手机扫码即打开 PWA，由 PWA 读取片段中的 Token 后从地址栏清除；将来的 Android 客户端（#19）解析同一格式。
- 二维码与 Token 一样默认隐藏，点击后才显示；监听「所有地址」时，二维码使用列表中排在最前的地址（Tailscale 优先，其次局域网私有地址；Clash / Mihomo 等 TUN 虚拟网卡的 `198.18.0.0/15` 排在最后，见 #25）。

## 备选与理由

- `qrcode`：最流行，但带 `pngjs`、`yargs`、`dijkstrajs` 三个依赖（命令行与 PNG 输出用不上）。
- `qrcode-generator`：零依赖，但体积约 555 KB。
- `lean-qr`：零依赖、体积相近，功能与 uqr 相当；uqr 的 API 更简单（直接得到矩阵）。
- 自写 QR 编码：Reed-Solomon 纠错与掩码选择实现成本高，没有必要。
- 只提供复制按钮：手机上粘贴 43 个字符的 Token 不便，且两台设备之间复制本身就需要额外工具。

## 已知限制

- 二维码包含 Token，截图或被旁人拍到即等同泄露；泄露后在设置页重新生成 Token。
