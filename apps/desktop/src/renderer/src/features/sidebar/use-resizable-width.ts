import { useRef, useState } from 'react'

interface ResizableWidth {
  width: number
  /** Props for the drag handle on the panel's right edge. */
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
    onDoubleClick: () => void
  }
}

const keyStep = 16
// Room kept for the main area, so a wide sidebar never squeezes the script list away.
const mainReserve = 480

/** Width of a left panel that the user drags from its right edge; persisted locally. */
export function useResizableWidth(
  storageKey: string,
  defaultWidth: number,
  minWidth: number
): ResizableWidth {
  const clamp = (value: number): number =>
    Math.round(
      Math.min(Math.max(value, minWidth), Math.max(minWidth, window.innerWidth - mainReserve))
    )

  const [width, setWidth] = useState(() => {
    const stored = Number(readStored(storageKey))
    return clamp(Number.isFinite(stored) && stored > 0 ? stored : defaultWidth)
  })
  const widthRef = useRef(width)

  const apply = (value: number, persist: boolean): void => {
    widthRef.current = clamp(value)
    setWidth(widthRef.current)
    if (persist) writeStored(storageKey, String(widthRef.current))
  }

  const onPointerDown = (event: React.PointerEvent<HTMLElement>): void => {
    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = widthRef.current
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()

    const onMove = (moveEvent: PointerEvent): void => {
      apply(startWidth + moveEvent.clientX - startX, false)
    }
    const onUp = (): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      writeStored(storageKey, String(widthRef.current))
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'ArrowLeft') apply(widthRef.current - keyStep, true)
    else if (event.key === 'ArrowRight') apply(widthRef.current + keyStep, true)
    else return
    event.preventDefault()
  }

  return {
    width,
    handleProps: { onPointerDown, onKeyDown, onDoubleClick: () => apply(defaultWidth, true) }
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage may be unavailable; the width still holds for this session.
  }
}
