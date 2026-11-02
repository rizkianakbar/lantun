import type { JSX } from 'preact'
import { CheckIcon } from './icons'

export const Bars = () => (
  <span class="bars" aria-hidden="true">
    <i />
    <i />
    <i />
    <i />
  </span>
)

// Filled segments for a stepped setting; purely visual, the value is in the label.
export const Pips = ({ value, max }: { value: number; max: number }) => (
  <span class="pips" aria-hidden="true">
    {Array.from({ length: max }, (_, i) => (
      <i key={i} class={i < value ? 'f' : undefined} />
    ))}
  </span>
)

interface TileProps {
  icon: JSX.Element
  label: string
  on: boolean
  onChange: (on: boolean) => void
}

export const Tile = ({ icon, label, on, onChange }: TileProps) => (
  <button type="button" class="tile" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
    <span class="ck" aria-hidden="true">
      <CheckIcon size={10} />
    </span>
    {icon}
    <span class="tl">{label}</span>
  </button>
)

interface CycleProps {
  icon: JSX.Element
  label: string
  value: number
  max: number
  valueText: string
  onChange: (value: number) => void
}

// One tap per level, wrapping back to off: quicker than a slider for three steps, and the pips
// show where you are.
export const CycleTile = ({ icon, label, value, max, valueText, onChange }: CycleProps) => (
  <button
    type="button"
    class="tile"
    data-on={value ? '' : undefined}
    aria-label={`${label}, ${valueText}`}
    onClick={() => onChange((value + 1) % (max + 1))}
  >
    {icon}
    <span class="tl">
      {label}
      <Pips value={value} max={max} />
    </span>
  </button>
)

export const Toggle = ({ icon, label, on, onChange }: TileProps) => (
  <button type="button" class="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
    {icon}
    <span>{label}</span>
    <span class="knobs" aria-hidden="true" />
  </button>
)
