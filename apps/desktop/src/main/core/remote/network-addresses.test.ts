import type { NetworkInterfaceInfo } from 'os'
import { describe, expect, it } from 'vitest'
import {
  isPrivateLanAddress,
  isTailscaleAddress,
  isVirtualAdapterAddress,
  listNetworkAddresses
} from './network-addresses'

const info = (
  address: string,
  family: 'IPv4' | 'IPv6' = 'IPv4',
  internal = false
): NetworkInterfaceInfo =>
  ({
    address,
    family,
    internal,
    netmask: '',
    mac: '',
    cidr: null,
    scopeid: 0
  }) as NetworkInterfaceInfo

describe('network addresses', () => {
  it.each([
    ['100.64.0.1', true],
    ['100.127.255.254', true],
    ['100.63.0.1', false],
    ['100.128.0.1', false],
    ['192.168.1.5', false],
    ['fd7a:115c:a1e0::1', true],
    ['FD7A:115C:A1E0:ab::1', true],
    ['fd00::1', false]
  ])('%s is Tailscale: %s', (address, expected) => {
    expect(isTailscaleAddress(address)).toBe(expected)
  })

  it('lists reachable addresses, Tailscale first, without loopback or link-local', () => {
    const addresses = listNetworkAddresses({
      lo: [info('127.0.0.1', 'IPv4', true), info('::1', 'IPv6', true)],
      eth0: [info('192.168.1.5'), info('fe80::1', 'IPv6'), info('2001:db8::5', 'IPv6')],
      tailscale0: [info('fd7a:115c:a1e0::9', 'IPv6'), info('100.101.1.2')],
      dup: [info('192.168.1.5')],
      empty: undefined
    })
    expect(addresses.map((entry) => entry.address)).toEqual([
      '100.101.1.2',
      'fd7a:115c:a1e0::9',
      '192.168.1.5',
      '2001:db8::5'
    ])
    expect(addresses[0]).toEqual({
      address: '100.101.1.2',
      family: 'IPv4',
      interfaceName: 'tailscale0',
      tailscale: true,
      virtual: false
    })
  })

  it.each([
    ['10.0.0.1', true],
    ['172.16.0.1', true],
    ['172.31.255.1', true],
    ['172.15.0.1', false],
    ['172.32.0.1', false],
    ['192.168.5.4', true],
    ['192.169.0.1', false],
    ['198.18.0.1', false],
    ['fd00::1', false]
  ])('%s is private LAN: %s', (address, expected) => {
    expect(isPrivateLanAddress(address)).toBe(expected)
  })

  it.each([
    ['198.18.0.1', true],
    ['198.19.255.254', true],
    ['198.17.0.1', false],
    ['198.20.0.1', false],
    ['192.168.5.4', false],
    ['2001:db8::1', false]
  ])('%s is a proxy virtual adapter: %s', (address, expected) => {
    expect(isVirtualAdapterAddress(address)).toBe(expected)
  })

  it('puts LAN before other addresses and proxy adapters last', () => {
    const addresses = listNetworkAddresses({
      Mihomo: [info('198.18.0.1')],
      Public: [info('2001:db8::5', 'IPv6'), info('203.0.113.7')],
      Ethernet: [info('192.168.5.4')],
      Tailscale: [info('100.101.1.2')]
    })
    expect(addresses.map((entry) => entry.address)).toEqual([
      '100.101.1.2',
      '192.168.5.4',
      '203.0.113.7',
      '2001:db8::5',
      '198.18.0.1'
    ])
    expect(addresses.map((entry) => entry.virtual)).toEqual([false, false, false, false, true])
  })
})
