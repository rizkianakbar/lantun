import { AX_DEFAULTS } from "../a11y/a11y.constants";
import type { ContrastMode } from "../a11y/a11y.types";
import type { RGB } from "../lib/color";
import { createStore } from "../lib/store";
import type { ReaderState } from "../reader/reader.types";
import type { ChevronDir } from "./icons";
import type { Strings } from "./ui.i18n";
import type { DockPlace, Edge } from "./ui.types";

export const HOST_TAG = "lantun-reader";
export const DOCK_STORAGE_KEY = "dock";
export const HINT_STORAGE_KEY = "hint-voice";

// Inline !important beats any page rule, including `* { all: unset !important }`. `filter` is left
// out because the a11y dark/invert modes counter-filter the host. view-transition-name keeps the
// widget still while the page crossfades between reading-aid looks.
export const HOST_STYLE =
  "position:fixed;inset:0;pointer-events:none;display:block;margin:0;padding:0;border:0;" +
  "width:auto;height:auto;max-width:none;max-height:none;background:none;opacity:1;visibility:visible;" +
  "transform:none;overflow:visible;clip-path:none;contain:none;view-transition-name:lantun-ui";

// The widget's dark surface; the brand colour is lifted until it reads on it.
export const SURFACE: RGB = [22, 21, 19];

export const TOAST_MS = 7000;
// Exit animations, matched in ui.styles.ts.
export const LEAVE_MS = 160;
// Sentences into the first listen before suggesting other voices.
export const HINT_AFTER = 2;

// Distance kept from the viewport edge.
export const EDGE = 12;
// Space between the dock and a panel it opens.
export const GAP = 12;
// Released this close to a side, the dock snaps flush against it.
export const SNAP = 80;
export const NARROW_PLACE: DockPlace = { x: 0.5, y: 1, o: "h" };

// The hidden tab's chevron points out of its edge, toward where the dock comes back.
export const OUT_OF: Record<Edge, ChevronDir> = { left: "right", right: "left", top: "down", bottom: "up" };

export const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];
// Circumference of the progress ring (r = 22).
export const RING = 2 * Math.PI * 22;
export const TIPS = { edge: "tipEdge", mac: "tipMac", ios: "tipIos" } as const;
export const MAX_STEP = 3;

export const MODES: { value: ContrastMode; label: keyof Strings; bg: string; fg: string }[] = [
  { value: "default", label: "contrastDefault", bg: "#f4f4f5", fg: "#18181b" },
  { value: "dark", label: "dark", bg: "#16161a", fg: "#e6e6e9" },
  { value: "light", label: "light", bg: "#fffaf0", fg: "#3b3b3b" },
  { value: "high", label: "high", bg: "#000", fg: "#ffe500" },
  { value: "invert", label: "invert", bg: "linear-gradient(135deg,#f4f4f5 50%,#18181b 50%)", fg: "transparent" },
];

// Half-height of the clear band the reading mask leaves around the pointer.
export const MASK_BAND = 64;

export const PLAY_HERE_SIZE = 28;
// Keeps the button up while the pointer travels from the text to it across the margin.
export const PLAY_HERE_HIDE_MS = 450;
// Selections settle over several selectionchange events.
export const SELECTION_SETTLE_MS = 220;
// Further than this from the pointer, the sentence is not the one being pointed at.
export const PLAY_HERE_MAX_DISTANCE = 400;

// Stand-ins so hooks run unconditionally when a feature is switched off.
export const NO_READER = createStore<ReaderState>({
  status: "idle",
  index: 0,
  total: 0,
  progress: 0,
  duration: 0,
  remaining: 0,
  remainingAfter: 0,
  rate: 1,
  voices: [],
  voice: null,
  voicesLoaded: true,
  resume: null,
  issue: null,
  engine: null,
  fallback: null,
});
export const NO_AX = createStore({ ...AX_DEFAULTS });
