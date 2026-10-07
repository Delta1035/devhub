import { useState } from 'react'
import { ScanLine, TriangleAlert } from 'lucide-react'
import { parseAddress, readConnectForm } from '@devhub/shared'
import type { ScanResult } from '@renderer/api/native-app'
import type { SavedConnection } from '@renderer/api/remote-connection'
import { Alert, AlertDescription } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

/** Shown in the web app and the Android app until the desktop accepts a token. */
export function ConnectPage({
  choosesAddress,
  address: savedAddress,
  checking,
  message,
  offline,
  onRetry,
  onChange,
  onScan,
  onSubmit
}: {
  /** The Android app asks for the desktop's address too; the web app is served by it. */
  choosesAddress: boolean
  address: string
  checking: boolean
  message: string | null
  offline: boolean
  onRetry: () => void
  onChange: () => void
  /** The Android app's QR scanner; absent elsewhere. */
  onScan?: () => Promise<ScanResult>
  onSubmit: (connection: SavedConnection) => void
}): React.JSX.Element {
  const [address, setAddress] = useState(savedAddress)
  const [token, setToken] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)

  const submit = (): void => {
    if (!choosesAddress) {
      if (token.trim()) onSubmit({ baseUrl: '', token: token.trim() })
      return
    }
    const form = readConnectForm(address, token)
    if (form.ok) {
      setInvalid(null)
      onSubmit(form.settings)
    } else setInvalid(form.message)
  }

  // The desktop's connect QR code holds the whole connect link, token included (ADR 0023).
  const scan = async (): Promise<void> => {
    if (!onScan) return
    const result = await onScan()
    if (!result.ok) {
      if (result.message) setInvalid(result.message)
      return
    }
    const parsed = parseAddress(result.text)
    if (!parsed?.token) return setInvalid('这不是 DevHub 的连接二维码')
    setInvalid(null)
    onSubmit({ baseUrl: parsed.baseUrl, token: parsed.token })
  }

  const alert = invalid ?? message
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center gap-2">
          <img src="./favicon.svg" alt="" className="size-7" />
          <h1 className="font-heading text-lg font-semibold">连接 DevHub</h1>
        </div>
        {checking ? (
          <p className="text-sm text-muted-foreground" role="status">
            正在连接…
          </p>
        ) : (
          <>
            {alert && (
              <Alert variant={offline && !invalid ? 'default' : 'destructive'}>
                <TriangleAlert />
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            )}
            {offline ? (
              <>
                <Button onClick={onRetry}>重试</Button>
                {choosesAddress && (
                  <Button variant="outline" onClick={onChange}>
                    更换桌面端
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {choosesAddress
                    ? '在电脑上打开 DevHub 的「设置 → 远程访问」，扫描连接二维码；或复制连接地址粘贴到下面（已包含访问令牌），也可以分别填写地址和访问令牌。'
                    : '在电脑上打开 DevHub 的「设置 → 远程访问」，用手机扫描连接二维码；也可以复制访问令牌粘贴到下面。'}
                </p>
                {onScan && (
                  <Button onClick={() => void scan()}>
                    <ScanLine />
                    扫码连接
                  </Button>
                )}
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    submit()
                  }}
                >
                  {choosesAddress && (
                    <Input
                      aria-label="桌面端地址"
                      placeholder="连接地址，例如 192.168.1.5:7420"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="url"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                    />
                  )}
                  <Input
                    aria-label="访问令牌"
                    placeholder={
                      choosesAddress ? '访问令牌（连接地址中已包含时可不填）' : '访问令牌'
                    }
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                  <Button type="submit" disabled={choosesAddress ? !address.trim() : !token.trim()}>
                    连接
                  </Button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
