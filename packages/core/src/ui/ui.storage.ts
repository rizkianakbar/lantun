import { isRecord, readJson, writeJson } from "../lib/storage";
import { DOCK_STORAGE_KEY } from "./ui.constants";
import type { DockState } from "./ui.types";

function fraction(value: unknown, fallback: number): number {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : fallback;
}

// `x` is the publisher's side; a reader's own placement always wins over it.
export function loadDock(x: number): DockState {
  const raw = readJson(DOCK_STORAGE_KEY);

  if (!isRecord(raw)) return { x, y: 0.5, o: "v", hidden: false };

  return {
    x: fraction(raw.x, x),
    y: fraction(raw.y, 0.5),
    o: raw.o === "h" ? "h" : "v",
    hidden: raw.hidden === true,
  };
}

export function saveDock(state: DockState): void {
  writeJson(DOCK_STORAGE_KEY, state);
}
