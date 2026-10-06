import { describe, expect, it } from 'vitest'
import { remoteConnectUrl } from '@devhub/shared'
import { parseAddress, readConnectForm } from './connect-input'

describe('parseAddress', () => {
  it('reads the connect link from the desktop QR code', () => {
    const link = remoteConnectUrl('192.168.1.5', 7420, 'a+b/c=')
    expect(parseAddress(link)).toEqual({ baseUrl: 'http://192.168.1.5:7420', token: 'a+b/c=' })
  })

  it('reads IPv6 links', () => {
    const link = remoteConnectUrl('fd7a:115c::1', 8000, 'tok')
    expect(parseAddress(link)).toEqual({ baseUrl: 'http://[fd7a:115c::1]:8000', token: 'tok' })
  })

  it('adds the scheme and default port to a bare host', () => {
    expect(parseAddress('  my-pc.tailnet.ts.net ')).toEqual({
      baseUrl: 'http://my-pc.tailnet.ts.net:7420'
    })
    expect(parseAddress('10.0.2.2:9000')).toEqual({ baseUrl: 'http://10.0.2.2:9000' })
  })

  it('keeps https and drops paths', () => {
    expect(parseAddress('HTTPS://Host.example/app?x=1')).toEqual({
      baseUrl: 'https://host.example:7420'
    })
  })

  it('rejects what is not an http address', () => {
    expect(parseAddress('')).toBeNull()
    expect(parseAddress('ftp://host')).toBeNull()
    expect(parseAddress('host:99999')).toBeNull()
    expect(parseAddress('user@host')).toBeNull()
    expect(parseAddress('has space')).toBeNull()
  })

  it('ignores a malformed token fragment', () => {
    expect(parseAddress('host#token=%E0%A4%A')).toEqual({ baseUrl: 'http://host:7420' })
    expect(parseAddress('host#other=1')).toEqual({ baseUrl: 'http://host:7420' })
  })
})

describe('readConnectForm', () => {
  it('prefers the token field over one in the link', () => {
    expect(readConnectForm('http://h:1/#token=old', ' new ')).toEqual({
      ok: true,
      settings: { baseUrl: 'http://h:1', token: 'new' }
    })
  })

  it('takes the token from a pasted link', () => {
    expect(readConnectForm('http://h:1/#token=abc', '')).toEqual({
      ok: true,
      settings: { baseUrl: 'http://h:1', token: 'abc' }
    })
  })

  it('explains what is missing', () => {
    expect(readConnectForm('', 'x')).toMatchObject({ ok: false })
    expect(readConnectForm('h', '')).toEqual({
      ok: false,
      message: '请填写 Token，或粘贴桌面端的连接地址'
    })
  })
})
