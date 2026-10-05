import { useMemo } from 'react'
import { encode } from 'uqr'

/**
 * A QR code drawn as one SVG path (ADR 0023). Always black on white whatever the theme:
 * phone cameras read dark modules on a light background most reliably.
 */
export function QrCode({
  value,
  size = 192,
  label
}: {
  value: string
  size?: number
  label: string
}): React.JSX.Element {
  const { path, modules } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      })
    )
    return { path: d, modules: qr.size }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className="rounded-md"
    >
      <rect width={modules} height={modules} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
