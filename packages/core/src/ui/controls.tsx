import type { JSX } from "preact";
import { CheckIcon } from "./icons";

type PipsProps = {
  value: number;
  max: number;
};

type TileProps = {
  icon: JSX.Element;
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
};

type CycleTileProps = {
  icon: JSX.Element;
  label: string;
  value: number;
  max: number;
  valueText: string;
  onChange: (value: number) => void;
};

export function Bars() {
  return (
    <span class="bars" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function Pips(props: PipsProps) {
  return (
    <span class="pips" aria-hidden="true">
      {Array.from({ length: props.max }, (_, i) => (
        <i key={i} class={i < props.value ? "f" : undefined} />
      ))}
    </span>
  );
}

export function Tile(props: TileProps) {
  const { icon, label, on, onChange } = props;

  return (
    <button type="button" class="tile" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span class="ck" aria-hidden="true">
        <CheckIcon size={10} />
      </span>
      {icon}
      <span class="tl">{label}</span>
    </button>
  );
}

// One tap per level, wrapping back to off.
export function CycleTile(props: CycleTileProps) {
  const { icon, label, value, max, valueText, onChange } = props;

  return (
    <button
      type="button"
      class="tile"
      data-on={value ? "" : undefined}
      aria-label={`${label}, ${valueText}`}
      onClick={() => onChange((value + 1) % (max + 1))}
    >
      {icon}
      <span class="tl">
        {label}
        <Pips value={value} max={max} />
      </span>
    </button>
  );
}

export function Toggle(props: TileProps) {
  const { icon, label, on, onChange } = props;

  return (
    <button type="button" class="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      {icon}
      <span>{label}</span>
      <span class="knobs" aria-hidden="true" />
    </button>
  );
}
