import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

/** Shown in the web app until the desktop accepts a token. */
export function ConnectPage({
  checking,
  message,
  offline,
  onRetry,
  onSubmit
}: {
  checking: boolean
  message: string | null
  offline: boolean
  onRetry: () => void
  onSubmit: (token: string) => void
}): React.JSX.Element {
  const [token, setToken] = useState('')

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
            {message && (
              <Alert variant={offline ? 'default' : 'destructive'}>
                <TriangleAlert />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            {offline ? (
              <Button onClick={onRetry}>重试</Button>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  在电脑上打开 DevHub 的「设置 →
                  远程访问」，用手机扫描连接二维码；也可以复制访问令牌粘贴到下面。
                </p>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (token.trim()) onSubmit(token.trim())
                  }}
                >
                  <Input
                    aria-label="访问令牌"
                    placeholder="访问令牌"
                    autoComplete="off"
                    spellCheck={false}
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                  <Button type="submit" disabled={!token.trim()}>
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
