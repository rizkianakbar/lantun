import type { Fixture } from "../fixtures";
import type { Setup } from "./demo.types";

export const CDN = "https://cdn.jsdelivr.net/npm/lantun@0.1/dist/";
// `pnpm --filter lantun serve`, for trying a local build with the bookmarklet.
export const LOCAL_CDN = "http://localhost:4173/";

export const DEFAULT_COLOR = "#f5b841";
export const SWATCHES = [
  { name: "Amber", value: DEFAULT_COLOR },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Teal", value: "#0d9488" },
  { name: "Blue", value: "#2563eb" },
] as const;

export const SETUPS: { id: Setup; label: string }[] = [
  { id: "script", label: "Any website" },
  { id: "js", label: "JavaScript" },
  { id: "react", label: "React" },
];

export const TAGS: Record<Fixture["layout"], string> = {
  hostile: "all: unset",
  wordpress: "Blog",
  news: "News site",
};

export const COPIED_MS = 1600;
