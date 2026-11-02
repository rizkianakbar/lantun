import type { RefObject } from "preact";

export type ElementRef = RefObject<HTMLElement | null>;

export type Orientation = "v" | "h";

// The dock's centre as fractions of the viewport (0 or 1 is flush against that edge), and which
// way it runs.
export type DockPlace = {
  x: number;
  y: number;
  o: Orientation;
};

export type DockState = DockPlace & {
  // Tucked away into its nearest edge.
  hidden: boolean;
};

export type Edge = "left" | "right" | "top" | "bottom";

export type Pop = "speed" | "voice" | "ax";

export type Triggers = Record<Pop, RefObject<HTMLButtonElement | null>>;

export type Toast = {
  text: string;
  // The one-time voice hint: marked with a sparkle, and the voice button glows while it shows.
  voiceHint?: boolean;
  action?: { label: string; run: () => void };
};

export type Box = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type Spot = {
  index: number;
  x: number;
  y: number;
};

export type Presence<T> = {
  shown: T | null;
  leaving: boolean;
};
