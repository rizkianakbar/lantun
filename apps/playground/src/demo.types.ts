import type { Lang } from "./highlight.types";

export type Side = "right" | "left";

export interface DemoOptions {
  color: string;
  side: Side;
}

export type Setup = "script" | "js" | "react";

export interface Snippet {
  // Shell command to run first, when the setup needs one.
  install?: string;
  code: string;
  lang: Lang;
  // Shown on the block's tab, as in an editor.
  file: string;
}
