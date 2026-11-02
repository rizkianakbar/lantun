import { isRecord, readJson, writeJson } from "./storage";

export type Orientation = "v" | "h";

// where the reader parked the dock: its centre as fractions of the viewport (0 or 1 means flush
// against that edge), which way it runs, and whether it is tucked away into the nearest edge.
export interface DockState {
  positionX: number;
  positionY: number;
  orientation: Orientation;
  hidden: boolean;
}

const KEY = "dock";

function fraction(v: unknown, fallback: number): number {
  return typeof v === "number" && v >= 0 && v <= 1 ? v : fallback;
}

// `x` falls back to the publisher's side; a reader's own placement always wins over it.
export function loadDock(x: number): DockState {
  const raw = readJson(KEY);

  if (!isRecord(raw)) {
    return {
      positionX: x,
      positionY: 0.5,
      orientation: "v",
      hidden: false,
    };
  }

  return {
    positionX: fraction(raw.positionX, x),
    positionY: fraction(raw.positionY, 0.5),
    orientation: raw.orientation === "h" ? "h" : "v",
    hidden: raw.hidden === true,
  };
}

export function saveDock(data: DockState): void {
  return writeJson(KEY, data);
}
