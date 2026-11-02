// Script-tag build (voice-kitten.js): registers with widget.js whichever loads first.
import type { VoiceEngine } from "@lantun/core";
import { kittenVoices } from "@lantun/voice-kitten";

type Host = Window & {
  LantunReader?: { registerVoices?: (engine: VoiceEngine) => void };
  __lantunVoices?: VoiceEngine[];
};

try {
  const host = window as Host;
  const engine = kittenVoices();
  if (host.LantunReader?.registerVoices)
    host.LantunReader.registerVoices(engine);
  else (host.__lantunVoices ??= []).push(engine);
} catch (err) {
  console.warn("[Lantun]", err);
}
