import { useRef, useState } from 'react'

interface ResizableHeight {
  height: number
  /** Attach to the drag handle's onPointerDown. */
  startResize: (event: React.PointerEvent<HTMLElement>) => void
}

/** Height of a bottom panel that the user drags from its top edge; persisted locally. */
export function useResizableHeight(
  storageKey: string,
  defaultHeight: number,
  minHeight: number
): ResizableHeight {
  // Leave room for the header and at least a few script rows above the panel.
  const clamp = (value: number): number =>
    Math.round(Math.min(Math.max(value, minHeight), Math.max(minHeight, window.innerHeight - 220)))

  const [height, setHeight] = useState(() => {
    const stored = Number(localStorage.getItem(storageKey))
    return clamp(Number.isFinite(stored) && stored > 0 ? stored : defaultHeight)
  })
  const heightRef = useRef(height)

  const startResize = (event: React.PointerEvent<HTMLElement>): void => {
    const handle = event.currentTarget
    const startY = event.clientY
    const startHeight = heightRef.current
    handle.setPointerCapture(event.pointerId)

    const onMove = (moveEvent: PointerEvent): void => {
      // Dragging up grows the panel.
      heightRef.current = clamp(startHeight + startY - moveEvent.clientY)
      setHeight(heightRef.current)
    }
    const onUp = (): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      localStorage.setItem(storageKey, String(heightRef.current))
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  return { height, startResize }
}
