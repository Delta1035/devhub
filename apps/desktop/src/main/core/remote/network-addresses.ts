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

/** RFC 1918 ranges: 10/8, 172.16/12, 192.168/16. */
export function isPrivateLanAddress(address: string): boolean {
  const [first, second] = address.split('.').map(Number)
  if (second === undefined) return false
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

/**
 * 198.18.0.0/15: the benchmarking range that Clash / Mihomo / Surge use for TUN adapters and
 * fake-ip, so it is reachable from this machine only.
 */
export function isVirtualAdapterAddress(address: string): boolean {
  const [first, second] = address.split('.').map(Number)
  return first === 198 && (second === 18 || second === 19)
}

/** Tailscale, then private LAN, then anything else, then proxy adapters; IPv4 before IPv6 in each. */
function rank(entry: NetworkAddress): number {
  const group = entry.tailscale ? 0 : isPrivateLanAddress(entry.address) ? 1 : entry.virtual ? 3 : 2
  return group * 2 + (entry.family === 'IPv4' ? 0 : 1)
}

/**
 * Addresses a phone could reach this machine on, best first (see `rank`).
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
        tailscale: isTailscaleAddress(info.address),
        virtual: isVirtualAdapterAddress(info.address)
      })
    }
  }
  return [...found.values()].sort((a, b) => rank(a) - rank(b))
}
