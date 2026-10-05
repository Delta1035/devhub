import type { NetworkInterfaceInfo } from 'os'
import type { NetworkAddress } from '@devhub/shared'

/** Shape of `os.networkInterfaces()`, injected so tests need no real adapters. */
export type InterfaceMap = NodeJS.Dict<NetworkInterfaceInfo[]>

/** Tailscale assigns 100.64.0.0/10 (CGNAT) and fd7a:115c:a1e0::/48. */
export function isTailscaleAddress(address: string): boolean {
  if (address.toLowerCase().startsWith('fd7a:115c:a1e0:')) return true
  const [first, second] = address.split('.').map(Number)
  return first === 100 && second !== undefined && second >= 64 && second <= 127
}

/**
 * Addresses a phone could reach this machine on, Tailscale first, then IPv4 before IPv6.
 * Loopback is offered separately; link-local IPv6 needs a scope id to listen on, so it is left out.
 */
export function listNetworkAddresses(interfaces: InterfaceMap): NetworkAddress[] {
  const found = new Map<string, NetworkAddress>()
  for (const [interfaceName, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.internal || info.address.toLowerCase().startsWith('fe80:')) continue
      if (found.has(info.address)) continue
      found.set(info.address, {
        address: info.address,
        family: info.family,
        interfaceName,
        tailscale: isTailscaleAddress(info.address)
      })
    }
  }
  const rank = (entry: NetworkAddress): number =>
    (entry.tailscale ? 0 : 2) + (entry.family === 'IPv4' ? 0 : 1)
  return [...found.values()].sort((a, b) => rank(a) - rank(b))
}
