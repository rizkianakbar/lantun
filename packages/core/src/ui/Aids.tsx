import { useRef } from 'preact/hooks'
import { usePointerY } from './hooks'

// Half-height of the clear band the reading mask leaves around the pointer.
const BAND = 64

export const ReadingGuide = () => {
  const ref = useRef<HTMLDivElement>(null)
  usePointerY((y) => {
    if (ref.current) ref.current.style.transform = `translateY(${y}px)`
  })
  return <div class="guide" ref={ref} aria-hidden="true" />
}

export const ReadingMask = () => {
  const top = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  usePointerY((y) => {
    // Both shades are viewport-tall and only translated: no layout work per frame.
    if (top.current) top.current.style.transform = `translateY(${y - BAND - window.innerHeight}px)`
    if (bottom.current) bottom.current.style.transform = `translateY(${y + BAND}px)`
  })
  return (
    <>
      <div class="shade" ref={top} aria-hidden="true" />
      <div class="shade" ref={bottom} aria-hidden="true" />
    </>
  )
}
