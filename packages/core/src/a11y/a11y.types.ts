import type { Store } from "../lib/store";
import type { PROFILES } from "./a11y.constants";

export type Step = 0 | 1 | 2 | 3;
export type FontMode = "default" | "readable" | "dyslexic";
export type ContrastMode = "default" | "dark" | "light" | "high" | "invert";

export interface AxSettings {
  text: Step;
  line: Step;
  spacing: Step;
  font: FontMode;
  contrast: ContrastMode;
  desaturate: boolean;
  links: boolean;
  cursor: boolean;
  guide: boolean;
  mask: boolean;
  still: boolean;
  noImages: boolean;
}

export type ProfileId = keyof typeof PROFILES;

export interface AxController {
  store: Store<AxSettings>;
  update(patch: Partial<AxSettings>): void;
  toggleProfile(id: ProfileId, active: boolean): void;
  reset(): void;
  destroy(): void;
}
