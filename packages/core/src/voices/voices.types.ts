export interface VoiceLabel {
  name: string;
  region: string;
  kind: "hd" | "natural" | "online" | "device";
}

export type VoiceTip = "edge" | "mac" | "ios";
