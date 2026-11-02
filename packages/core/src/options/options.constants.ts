import type { RGB } from "../lib/color";
import type { Position } from "./options.types";

// Marigold: reads as a highlighter pen on the page, and is nobody else's blue.
export const DEFAULT_COLOR = "#f5b841";
export const DEFAULT_RGB: RGB = [245, 184, 65];
export const DEFAULT_Z_INDEX = 2147483000;

export const POSITIONS: readonly Position[] = ["right", "left", "bottom-right", "bottom-left"];
