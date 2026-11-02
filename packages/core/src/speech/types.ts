// Provider-agnostic speech contract. Web Speech is the built-in driver; add-on engines such as
// @lantun/voice-kitten implement the same interface (as VoiceEngine) and register at runtime.

export interface Voice {
  id: string
  name: string
  lang: string
  local: boolean
  isDefault: boolean
  // Add-on voices only: the engine that speaks it, and what it downloads before its first use.
  engine?: string
  downloadBytes?: number
  // Shown in the voice menu when the name alone does not say it (add-on voices).
  gender?: 'female' | 'male'
}

export interface SpeakRequest {
  text: string
  lang: string
  rate: number
  voice: Voice | null
}

export interface SpeechErrorInfo {
  code: string
  message: string
}

export interface SpeakHandlers {
  onStart?: () => void
  // charIndex is relative to SpeakRequest.text. `estimated` is set when timing is guessed
  // because the voice fires no boundary events (highlight/word-timing.ts).
  onWord: (charIndex: number, estimated?: boolean) => void
  onEnd: () => void
  onError: (err: SpeechErrorInfo) => void
}

export interface SpeechDriver {
  readonly id: string
  // False when pause()/resume() cannot be trusted; the player then pauses by cancelling and
  // re-speaking from the last word instead.
  readonly reliablePause: boolean
  // Synthesis takes noticeable time before audio starts (on-device neural voices). The player
  // then starts its stall watchdog when audio starts instead of when speak() is called.
  readonly slowStart?: boolean
  getVoices(): Promise<Voice[]>
  // Hint that this text is probably next, so engines that synthesise ahead can start on it.
  prepare?(req: SpeakRequest): void
  // True when setRate() changes the speed of the utterance in progress. Otherwise the player
  // applies a new rate by re-speaking from the last word.
  readonly liveRate?: boolean
  setRate?(rate: number): void
  // Replaces anything in flight. After cancel() or a new speak(), the old handlers never fire again.
  speak(req: SpeakRequest, handlers: SpeakHandlers): void
  pause(): void
  resume(): void
  cancel(): void
}

export interface EngineStatus {
  state: 'idle' | 'loading' | 'ready' | 'error'
  // 0–1 while loading.
  progress: number
  // Why it is unusable: too slow on this device to keep up with playback, or failed to load.
  error?: 'slow' | 'failed'
}

// An add-on voice provider. Its voices carry `engine: id`, and it reports download progress.
export interface VoiceEngine extends SpeechDriver {
  status(): EngineStatus
  subscribe(cb: (status: EngineStatus) => void): () => void
}
