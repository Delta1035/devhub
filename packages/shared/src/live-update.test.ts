import { describe, expect, it } from 'vitest'
import { checkLiveUpdate, planLiveUpdate, protocolMismatch } from './live-update'
import { remoteProtocolVersion } from './remote'

const manifest = {
  version: '1.4.0',
  minVersionCode: 10400,
  bundle: 'devhub-web-1.4.0.zip',
  checksum: 'a'.repeat(64),
  signature: 'c2lnbmF0dXJl'
}

describe('planLiveUpdate', () => {
  it('does nothing while showing the desktop version', () => {
    expect(planLiveUpdate({ desktopVersion: '1.4.0', current: '1.4.0', builtIn: '1.3.0' })).toEqual(
      { action: 'none' }
    )
  })

  it('does nothing for desktops that do not report a usable version', () => {
    expect(
      planLiveUpdate({ desktopVersion: undefined, current: '1.3.0', builtIn: '1.3.0' })
    ).toEqual({ action: 'none' })
    expect(
      planLiveUpdate({ desktopVersion: '1.4.0-dev', current: '1.3.0', builtIn: '1.3.0' })
    ).toEqual({ action: 'none' })
  })

  it('fetches the bundle of another desktop version, newer or older', () => {
    expect(planLiveUpdate({ desktopVersion: '1.5.0', current: '1.4.0', builtIn: '1.4.0' })).toEqual(
      { action: 'fetch', version: '1.5.0' }
    )
    expect(planLiveUpdate({ desktopVersion: '1.2.0', current: '1.4.0', builtIn: '1.4.0' })).toEqual(
      { action: 'fetch', version: '1.2.0' }
    )
  })

  it('returns to the built-in bundle when the desktop matches it again', () => {
    expect(planLiveUpdate({ desktopVersion: '1.3.0', current: '1.4.0', builtIn: '1.3.0' })).toEqual(
      { action: 'reset' }
    )
  })
})

describe('checkLiveUpdate', () => {
  it('downloads a bundle this app build can run', () => {
    expect(checkLiveUpdate(manifest, { version: '1.4.0', versionCode: 10400 })).toEqual({
      action: 'download',
      manifest
    })
  })

  it('asks for a newer APK when the bundle needs newer native code', () => {
    expect(checkLiveUpdate(manifest, { version: '1.4.0', versionCode: 10300 })).toEqual({
      action: 'install-apk',
      version: '1.4.0'
    })
  })

  it('rejects malformed manifests and manifests of another version', () => {
    expect(
      checkLiveUpdate({ ...manifest, checksum: 'xyz' }, { version: '1.4.0', versionCode: 1 })
    ).toMatchObject({ action: 'invalid' })
    expect(
      checkLiveUpdate({ ...manifest, bundle: '../x.zip' }, { version: '1.4.0', versionCode: 1 })
    ).toMatchObject({ action: 'invalid' })
    expect(checkLiveUpdate(manifest, { version: '1.5.0', versionCode: 99999 })).toMatchObject({
      action: 'invalid'
    })
    expect(checkLiveUpdate('<html>', { version: '1.4.0', versionCode: 1 })).toMatchObject({
      action: 'invalid'
    })
  })
})

describe('protocolMismatch', () => {
  it('names the side that is behind', () => {
    expect(protocolMismatch(remoteProtocolVersion)).toBeNull()
    expect(protocolMismatch(remoteProtocolVersion - 1)).toBe('desktop')
    expect(protocolMismatch(remoteProtocolVersion + 1)).toBe('app')
  })
})
