import type { SpeechDriver, Voice } from '../speech/types'

export interface WordTimingOptions {
  // How long to wait for a first boundary event before deciding a voice has none (spec: ~500 ms).
  detectMs?: number
  onFallback?: (voice: Voice | null, lang: string) => void
}

// Starting guess for speaking speed at rate 1, refined per voice from measured utterances.
const DEFAULT_CPS = 14
// Weight of the newest measurement; smooths out sentences with long pauses in them.
const LEARN_WEIGHT = 0.4

const wordStarts = (text: string): number[] => Array.from(text.matchAll(/\S+/g), (m) => m.index ?? 0)

// Decorates a driver so voices that never fire word boundaries (several network voices) still
// produce word events, estimated from character position and a learned characters-per-second.
export const withWordTiming = (driver: SpeechDriver, o: WordTimingOptions = {}): SpeechDriver => {
  const detectMs = o.detectMs ?? 500
  const hasBoundaries = new Map<string, boolean>()
  const cps = new Map<string, number>()
  let timers: ReturnType<typeof setTimeout>[] = []
  // Pause support for drivers with reliable native pause; estimated timers must stop with the audio.
  let onPause: (() => void) | null = null
  let onResume: (() => void) | null = null

  const clear = (): void => {
    timers.forEach(clearTimeout)
    timers = []
  }

  return {
    id: driver.id,
    // Getters: the wrapped driver may switch engines between utterances (speech/mixed.ts).
    get reliablePause() {
      return driver.reliablePause
    },
    get slowStart() {
      return driver.slowStart
    },
    getVoices: () => driver.getVoices(),
    prepare: (req) => driver.prepare?.(req),
    speak(req, h) {
      clear()
      onPause = onResume = null
      const key = req.voice?.id ?? `default:${req.lang}`
      const starts = wordStarts(req.text)
      let startedAt = 0
      let elapsedAtPause = 0
      let estimating = false
      let sawBoundary = false

      const estimate = (elapsed: number): void => {
        estimating = true
        const perMs = ((cps.get(key) ?? DEFAULT_CPS) * req.rate) / 1000
        let caughtUp = -1
        for (const i of starts) {
          const delay = i / perMs - elapsed
          if (delay > 0) timers.push(setTimeout(() => h.onWord(i, true), delay))
          else caughtUp = i
        }
        // Already past some words (late detection or resume): jump straight to the current one.
        if (caughtUp >= 0) h.onWord(caughtUp, true)
      }

      onPause = () => {
        elapsedAtPause = Date.now() - startedAt
        clear()
      }
      onResume = () => {
        startedAt = Date.now() - elapsedAtPause
        if (estimating) estimate(elapsedAtPause)
      }

      driver.speak(req, {
        onStart: () => {
          startedAt = Date.now()
          h.onStart?.()
          const known = hasBoundaries.get(key)
          if (known === false) {
            estimate(0)
          } else if (known === undefined) {
            timers.push(
              setTimeout(() => {
                if (sawBoundary) return
                hasBoundaries.set(key, false)
                o.onFallback?.(req.voice, req.lang)
                estimate(Date.now() - startedAt)
              }, detectMs),
            )
          }
        },
        onWord: (i) => {
          if (estimating) return
          sawBoundary = true
          hasBoundaries.set(key, true)
          h.onWord(i)
        },
        onEnd: () => {
          clear()
          const elapsed = Date.now() - startedAt
          // Learn from whole utterances only; tiny ones are dominated by start-up latency.
          if (estimating && startedAt && elapsed > 500 && req.text.length > 20) {
            const measured = req.text.length / (elapsed / 1000) / req.rate
            const prev = cps.get(key)
            cps.set(key, prev === undefined ? measured : prev + (measured - prev) * LEARN_WEIGHT)
          }
          h.onEnd()
        },
        onError: (err) => {
          clear()
          h.onError(err)
        },
      })
    },
    pause() {
      onPause?.()
      driver.pause()
    },
    resume() {
      onResume?.()
      driver.resume()
    },
    cancel() {
      clear()
      onPause = onResume = null
      driver.cancel()
    },
  }
}
