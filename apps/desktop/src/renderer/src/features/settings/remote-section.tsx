import { useState } from 'react'
import {
  remoteConnectUrl,
  type NetworkAddress,
  type RemoteConfigPatch,
  type RemoteState
} from '@devhub/shared'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { QrCode } from './qr-code'
import { NumberSetting, Segmented, SettingRow, SettingsSection } from './settings-controls'
import { useRegenerateRemoteToken, useRemoteState, useUpdateRemote } from './use-remote'

const selectClass =
  'h-8 min-w-56 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

const loopback = '127.0.0.1'
const everyInterface = '0.0.0.0'

/** Remote access for the phone (ADR 0022). Only on the desktop itself: it shows the token. */
export function RemoteSection({
  onError
}: {
  onError: (message: string | null) => void
}): React.JSX.Element | null {
  return shell ? <RemoteSettings onError={onError} /> : null
}

function RemoteSettings({
  onError
}: {
  onError: (message: string | null) => void
}): React.JSX.Element | null {
  const remote = useRemoteState()
  const update = useUpdateRemote()
  const regenerate = useRegenerateRemoteToken()
  const fail = (failure: Error): void => onError(failure.message)
  const save = (patch: RemoteConfigPatch): void => {
    onError(null)
    update.mutate(patch, { onError: fail })
  }

  const state = remote.data
  if (!state) return null

  return (
    <SettingsSection title="远程访问">
      <SettingRow label="允许手机远程访问" description={<StatusText state={state} />}>
        <Segmented
          label="允许手机远程访问"
          value={state.enabled ? 'on' : 'off'}
          onChange={(value) => save({ enabled: value === 'on' })}
          options={[
            { value: 'off', label: '关闭' },
            { value: 'on', label: '开启' }
          ]}
        />
      </SettingRow>
      <SettingRow label="监听地址" htmlFor="settings-remote-host" description={hostAdvice(state)}>
        <select
          id="settings-remote-host"
          className={selectClass}
          value={state.host}
          onChange={(event) => save({ host: event.target.value })}
        >
          {hostOptions(state).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="端口" htmlFor="settings-remote-port">
        <NumberSetting
          id="settings-remote-port"
          value={state.port}
          min={1024}
          max={65535}
          onCommit={(port) => save({ port })}
        />
      </SettingRow>
      <TokenRow
        state={state}
        regenerate={() => {
          onError(null)
          regenerate.mutate(undefined, { onError: fail })
        }}
      />
      <SettingRow
        label="远程终端"
        description={
          state.allowTerminal ? (
            <span className="text-destructive">
              已允许：手机可以新建终端并输入命令，等同于在这台电脑上执行任意命令
            </span>
          ) : (
            '关闭时手机只能查看输出、启动和停止脚本，不能新建终端或输入'
          )
        }
      >
        <Segmented
          label="远程终端"
          value={state.allowTerminal ? 'on' : 'off'}
          onChange={(value) => save({ allowTerminal: value === 'on' })}
          options={[
            { value: 'off', label: '不允许' },
            { value: 'on', label: '允许' }
          ]}
        />
      </SettingRow>
    </SettingsSection>
  )
}

function StatusText({ state }: { state: RemoteState }): React.JSX.Element {
  const { status } = state
  if (status.state === 'error') {
    return (
      <span className="text-destructive" role="status">
        {status.message}
      </span>
    )
  }
  if (status.state === 'listening') {
    return (
      <span role="status" className="break-all">
        监听中：{displayHost(state)}:{status.port}
      </span>
    )
  }
  return <span role="status">关闭时不监听任何端口</span>
}

function hostOptions(state: RemoteState): { value: string; label: string }[] {
  const options = state.addresses.map((entry) => ({
    value: entry.address,
    label: `${entry.address}（${entry.interfaceName}${addressNote(entry)}）`
  }))
  options.push(
    { value: loopback, label: `${loopback}（仅本机，用于测试）` },
    { value: everyInterface, label: '所有地址' }
  )
  // A saved address that is gone for now, e.g. Tailscale disconnected.
  if (!options.some((option) => option.value === state.host)) {
    options.unshift({ value: state.host, label: `${state.host}（当前不可用）` })
  }
  return options
}

function addressNote(entry: NetworkAddress): string {
  if (entry.tailscale) return '，推荐'
  if (entry.virtual) return '，虚拟网卡（手机通常无法访问）'
  return ''
}

function hostAdvice(state: RemoteState): string {
  if (state.host === loopback) return '只有这台电脑能访问，手机无法连接'
  if (state.addresses.find((entry) => entry.address === state.host)?.tailscale) {
    return '经 Tailscale 加密传输'
  }
  return '局域网中以明文传输，同一网络的设备可能看到 Token 和日志；推荐使用 Tailscale'
}

/** The address a phone should use: the chosen one, or the best one when listening everywhere. */
function displayHost(state: RemoteState): string {
  if (state.host !== everyInterface) return state.host
  return state.addresses[0]?.address ?? loopback
}

function TokenRow({
  state,
  regenerate
}: {
  state: RemoteState
  regenerate: () => void
}): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const connectUrl = remoteConnectUrl(displayHost(state), state.port, state.token)

  const copy = (): void => {
    void navigator.clipboard.writeText(state.token).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <SettingRow
        label="访问令牌"
        description={
          <span className="font-mono break-all" aria-label="访问令牌内容">
            {revealed ? state.token : '•'.repeat(24)}
          </span>
        }
      >
        <Button variant="outline" size="sm" onClick={() => setRevealed(!revealed)}>
          {revealed ? '隐藏' : '显示'}
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? '已复制' : '复制'}
        </Button>
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirming(false)
                regenerate()
              }}
            >
              确认重新生成
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              取消
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            重新生成…
          </Button>
        )}
      </SettingRow>
      {confirming && (
        <div className="px-4 pb-3 text-xs text-muted-foreground">
          旧令牌立即失效，已连接的设备会断开，需要用新令牌重新连接。
        </div>
      )}
      <SettingRow
        label="连接二维码"
        description="用手机扫码打开并连接；二维码包含令牌，不要截图或给他人看"
      >
        <Button variant="outline" size="sm" onClick={() => setShowQr(!showQr)}>
          {showQr ? '隐藏二维码' : '显示二维码'}
        </Button>
      </SettingRow>
      {showQr && (
        <div className="flex flex-col items-center gap-2 px-4 pb-4">
          <QrCode value={connectUrl} label="连接二维码" />
          <span className="text-xs break-all text-muted-foreground">
            {connectUrl.replace(/#token=.*/, '#token=…')}
          </span>
          {state.status.state !== 'listening' && (
            <span className="text-xs text-muted-foreground">远程访问未在运行，扫码后无法连接</span>
          )}
        </div>
      )}
    </>
  )
}
