import type { JSX } from "preact";

// 24px grid, currentColor. aria-hidden: every icon sits inside a labelled control.
type SvgProps = {
  children: JSX.Element | JSX.Element[];
  size?: number | undefined;
  fill?: boolean;
};

export type IconProps = {
  size?: number;
};

function Svg(props: SvgProps) {
  const { children, size = 20, fill } = props;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg size={props.size} fill>
      <path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z" />
    </Svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg size={props.size} fill>
      <rect x="6" y="5" width="4.2" height="14" rx="1.3" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.3" />
    </Svg>
  );
}

type SkipIconProps = IconProps & {
  ahead?: boolean;
};

export function SkipIcon(props: SkipIconProps) {
  const { size = 18, ahead } = props;

  return (
    <Svg size={size}>
      <g transform={ahead ? "matrix(-1 0 0 1 24 0)" : undefined}>
        <path d="M5.4 8.6A7.6 7.6 0 1 1 4.4 12.4" />
        <path d="M4.8 4.2v4.6h4.6" />
      </g>
      <path d="M9.6 10.8h4.8M9.6 14h3.2" stroke-width="1.8" />
    </Svg>
  );
}

export function VoiceIcon(props: IconProps) {
  const { size = 18 } = props;

  return (
    <Svg size={size}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.4-3.4 3.1-5.5 6.5-5.5s6.1 2.1 6.5 5.5M16.6 6.2a3.6 3.6 0 0 1 0 4.8M19.2 3.8a7.2 7.2 0 0 1 0 9.6" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  const { size = 18 } = props;

  return (
    <Svg size={size}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function AccessIcon(props: IconProps) {
  const { size = 22 } = props;

  return (
    <Svg size={size}>
      <circle cx="12" cy="4.6" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 8.4c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.4v4.4M12 13.8l-3 6.4M12 13.8l3 6.4" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { size = 16 } = props;

  return (
    <Svg size={size}>
      <path d="m5 12.5 4.2 4L19 7" />
    </Svg>
  );
}

export function MinusIcon() {
  return (
    <Svg size={16}>
      <path d="M6 12h12" />
    </Svg>
  );
}

export function PlusIcon() {
  return (
    <Svg size={16}>
      <path d="M12 6v12M6 12h12" />
    </Svg>
  );
}

export type ChevronDir = "left" | "right" | "up" | "down";

const CHEVRON: Record<ChevronDir, string> = {
  left: "m14.5 6-6 6 6 6",
  right: "m9.5 6 6 6-6 6",
  up: "m6 14.5 6-6 6 6",
  down: "m6 9.5 6 6 6-6",
};

type ChevronIconProps = {
  dir: ChevronDir;
};

export function ChevronIcon(props: ChevronIconProps) {
  return (
    <Svg size={14}>
      <path d={CHEVRON[props.dir]} />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  const { size = 13 } = props;

  return (
    <Svg size={size} fill>
      <path d="M12 2.5l2 6.4 6.5 2.1-6.5 2.1-2 6.4-2-6.4-6.5-2.1 6.5-2.1Z" />
    </Svg>
  );
}

export function GripIcon() {
  return (
    <Svg size={12} fill>
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </Svg>
  );
}

export function EyeIcon() {
  return (
    <Svg size={18}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function BookIcon() {
  return (
    <Svg size={18}>
      <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2ZM12 6.5v13" />
    </Svg>
  );
}

export function FocusIcon() {
  return (
    <Svg size={18}>
      <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function CalmIcon() {
  return (
    <Svg size={18}>
      <path d="M12 3.5 4.5 6.5v5c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9v-5L12 3.5Z" />
      <path d="M8.5 12.5c1.2-1.3 2.3-1.3 3.5 0s2.3 1.3 3.5 0" />
    </Svg>
  );
}

export function GlassesIcon() {
  return (
    <Svg size={18}>
      <circle cx="6.5" cy="14.5" r="3.5" />
      <circle cx="17.5" cy="14.5" r="3.5" />
      <path d="M10 14c1.3-.8 2.7-.8 4 0M3 14l1.5-6.5L7 6.5M21 14l-1.5-6.5L17 6.5" />
    </Svg>
  );
}

export function LineHeightIcon() {
  return (
    <Svg size={22}>
      <path d="M11 6.5h9M11 12h9M11 17.5h9M5 4.5v15M2.8 7 5 4.5 7.2 7M2.8 17 5 19.5 7.2 17" />
    </Svg>
  );
}

export function SpacingIcon() {
  return (
    <Svg size={22}>
      <path d="M6 13.5 9 5l3 8.5M7 10.5h4M14.5 13.5V5h2.7a2.1 2.1 0 0 1 0 4.2h-2.7 3.1a2.15 2.15 0 0 1 0 4.3h-3.1M3.5 19h17M6 17l-2.5 2L6 21M18 17l2.5 2-2.5 2" />
    </Svg>
  );
}

export function FontIcon() {
  return (
    <Svg size={22}>
      <path d="M3.5 18.5 8.5 5.5l5 13M5.4 13.5h6.2M20 10.5v8M20 13.2c-.5-1.7-1.6-2.7-3.1-2.7-1.9 0-3.1 1.6-3.1 4s1.2 4 3.1 4c1.5 0 2.6-1 3.1-2.7" />
    </Svg>
  );
}

export function DyslexiaIcon() {
  return (
    <Svg size={22}>
      <path d="M4 4.5v14.5M20 4.5v14.5" />
      <circle cx="7.6" cy="15.2" r="3.6" />
      <circle cx="16.4" cy="15.2" r="3.6" stroke-width="2.8" />
    </Svg>
  );
}

export function LinkIcon() {
  return (
    <Svg size={22}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </Svg>
  );
}

export function CursorIcon() {
  return (
    <Svg size={22}>
      <path d="M5 3.5 18.5 10l-6 1.8-2.4 6L5 3.5Z" />
      <path d="m12.8 12 5.7 6.5" />
    </Svg>
  );
}

export function GuideIcon() {
  return (
    <Svg size={22}>
      <path d="M4 5.5h16M4 18.5h11" opacity=".45" />
      <rect x="2.5" y="9.5" width="19" height="5" rx="1.5" />
    </Svg>
  );
}

export function MaskIcon() {
  return (
    <Svg size={22}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <path d="M2.5 9.5h19M2.5 14.5h19" />
      <path d="M5 6.5h14M5 17.5h14" opacity=".45" />
    </Svg>
  );
}

export function StillIcon() {
  return (
    <Svg size={22}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9v6M14.2 9v6" />
    </Svg>
  );
}

export function NoImageIcon() {
  return (
    <Svg size={22}>
      <path d="M8 4h11a2 2 0 0 1 2 2v11M19 21H5a2 2 0 0 1-2-2V5M3 15l4.5-4.5 5 5M14 14l1.5-1.5 4 4M3 3l18 18" />
    </Svg>
  );
}

export function GrayscaleIcon() {
  return (
    <Svg size={18}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}
