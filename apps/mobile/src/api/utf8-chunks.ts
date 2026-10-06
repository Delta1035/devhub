/**
 * Decodes a UTF-8 byte stream chunk by chunk with a decoder that only handles whole input.
 * React Native's native `TextDecoder` is not spec-compliant (Expo docs), so `{ stream: true }`
 * cannot be relied on; a character split between two chunks is held back instead.
 */
export function createChunkDecoder(
  decode: (bytes: Uint8Array) => string
): (chunk: Uint8Array) => string {
  let carry = new Uint8Array(0)
  return (chunk) => {
    const bytes = carry.length === 0 ? chunk : concat(carry, chunk)
    const cut = completeLength(bytes)
    carry = bytes.slice(cut)
    return cut === 0 ? '' : decode(bytes.subarray(0, cut))
  }
}

/** Length of the prefix that ends on a character boundary. */
function completeLength(bytes: Uint8Array): number {
  // A UTF-8 character is at most 4 bytes: look back at most 3 for the lead byte.
  for (let back = 1; back <= Math.min(3, bytes.length); back++) {
    const byte = bytes[bytes.length - back] ?? 0
    if ((byte & 0xc0) === 0x80) continue // continuation byte
    const size = byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1
    return size > back ? bytes.length - back : bytes.length
  }
  return bytes.length
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}
