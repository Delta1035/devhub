# Phone access

With remote access on, you can browse projects, start / stop scripts and read logs from your phone's browser. The phone opens DevHub's built-in web app, served by the desktop itself; nothing else to deploy.

[Tailscale](https://tailscale.com/) is recommended: with the phone and the computer in the same tailnet, traffic is encrypted by WireGuard and works away from home too.

## Connect with the QR code

1. On the computer, open **设置 → 远程访问** (Settings → Remote access) and turn on **允许手机远程访问** (allow remote access from phone).
2. Under **监听地址** (listen address), pick the Tailscale address (`100.x.y.z`) marked **推荐** (recommended).
3. Click **显示二维码** (show QR code) and scan it with the phone. The browser opens DevHub and connects; the token is kept in the phone's browser, so later you just open the same address.

The QR code contains the access token: do not screenshot or share it. If it may have leaked, click **重新生成…** (regenerate); connected devices are dropped at once.

## Install to the home screen (HTTPS)

Browsers only offer "Add to Home screen / Install app" on HTTPS pages. DevHub does not serve HTTPS itself; Tailscale does it:

1. In the Tailscale admin console's DNS page, enable MagicDNS and HTTPS certificates.
2. Set DevHub's **监听地址** to `127.0.0.1`.
3. On the computer, run (same port as in the settings):

   ```sh
   tailscale serve --bg 7420
   ```

   It prints the address, like `https://your-machine.your-tailnet.ts.net/`.

4. Open that address in the phone's browser and paste the access token (copy it from **访问令牌**, the access token, on the computer). You can also open `https://your-machine.your-tailnet.ts.net/#token=<token>`; the token is removed from the address bar once read.
5. In Chrome's menu, choose "Add to Home screen" or "Install app".

To stop serving: `tailscale serve --https=443 off`. To see the current setup: `tailscale serve status`.

`tailscale serve` is only reachable from devices in your tailnet, not from the internet (that is `tailscale funnel`; do not use it).

## What the phone can do

- Browse projects, scripts, batch tasks and run history; start / stop / restart scripts and run batch tasks.
- Read terminal output. **远程终端** (remote terminal) is off by default: the phone cannot open terminals or type into them. Turned on, the phone can run any command on the computer; enable it with care.
- Adding / removing projects, changing DevHub's settings, opening projects in an editor and other actions that change the computer stay on the computer.

## Troubleshooting

- **The QR link does not open**: check that the phone is connected to Tailscale and the listen address is not `127.0.0.1` (unless you use `tailscale serve`).
- **访问令牌无效或已重新生成** (token invalid or regenerated): the token was regenerated on the computer; paste the new one.
- **Direct LAN access**: you can also listen on a LAN address or on all addresses, but then it is plain HTTP and devices on the same network may see the token and logs.
