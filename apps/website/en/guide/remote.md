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

## Android app

If you prefer not to use the browser, install the Android app. It has the same interface as the web app, but needs no HTTPS, and keeps the access token encrypted in the Android Keystore.

1. Download `DevHub-<version>.apk` from [Releases](https://github.com/Delta1035/devhub/releases) and open it on the phone to install it (allow "Install unknown apps"). The app shares the desktop's version number; install the same version.
2. Turn on remote access on the computer (as above) and note the **监听地址** (listen address) and port.
3. In the app, enter `address:port` (such as `100.64.1.2:7420`) as **桌面端地址** (desktop address), paste the token copied on the computer as **访问令牌** (access token), and tap **连接** (connect). You can also scan the QR code with the phone's camera and paste the link it shows into the address field; the token is read from it.

The app reconnects by itself from then on. After the token is regenerated, it returns to the connect page: enter the new token. To connect to another computer, tap **更换桌面端** (change desktop) on the page shown when the connection fails.

## What the phone can do

- Browse projects, scripts, batch tasks and run history; start / stop / restart scripts and run batch tasks.
- Read terminal output. **远程终端** (remote terminal) is off by default: the phone cannot open terminals or type into them. Turned on, the phone can run any command on the computer; enable it with care.
- Adding / removing projects, changing DevHub's settings, opening projects in an editor and other actions that change the computer stay on the computer.

## Troubleshooting

- **The QR link does not open**: check that the phone is connected to Tailscale and the listen address is not `127.0.0.1` (unless you use `tailscale serve`).
- **访问令牌无效或已重新生成** (token invalid or regenerated): the token was regenerated on the computer; paste the new one.
- **Direct LAN access**: you can also listen on a LAN address or on all addresses, but then it is plain HTTP and devices on the same network may see the token and logs.
