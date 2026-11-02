import type { Word } from "../segment/segment.types";
import type { SpeechErrorInfo } from "../speech/speech.types";
import {
  CHARS_PER_SECOND,
  MAX_RETRIES,
  PARAGRAPH_PAUSE_MS,
  PREFETCH,
  REWIND_CHARS,
  STALL_MARGIN_MS,
} from "./player.constants";
import { clampRate, wordAt } from "./player.lib";
import type { Player, PlayerOptions, PlayerStatus } from "./player.types";

export function createPlayer(options: PlayerOptions): Player {
  const { driver, text, sentences, lang, emit } = options;

  let status: PlayerStatus = "idle";
  let index = 0;
  // Absolute text offset to restart from within the current sentence; -1 means its start.
  let resumeAt = -1;
  let lastWord: Word | null = null;
  let rate = clampRate(options.rate ?? 1);
  let voice = options.voice ?? null;
  let retries = 0;
  let nativePaused = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let gap: ReturnType<typeof setTimeout> | undefined;

  function clampIndex(target: number): number {
    return Math.min(Math.max(target, 0), Math.max(sentences.length - 1, 0));
  }

  function setStatus(next: PlayerStatus): void {
    if (status === next) return;

    status = next;
    emit("state", next);
  }

  function clearWatchdog(): void {
    clearTimeout(watchdog);
    watchdog = undefined;
  }

  function armWatchdog(chars: number): void {
    clearWatchdog();
    watchdog = setTimeout(onStall, (chars / (CHARS_PER_SECOND * rate)) * 2000 + STALL_MARGIN_MS);
  }

  function halt(): void {
    driver.cancel();
    clearTimeout(gap);
    gap = undefined;
    clearWatchdog();
  }

  function pauseBefore(i: number): number {
    const prev = sentences[i - 1];
    const next = sentences[i];

    return prev && next && text.slice(prev.end, next.start).includes("\n") ? PARAGRAPH_PAUSE_MS / rate : 0;
  }

  function emitSentence(): void {
    const sentence = sentences[index];

    if (!sentence) return;

    emit("sentence", {
      index,
      start: sentence.start,
      end: sentence.end,
      text: text.slice(sentence.start, sentence.end),
    });
  }

  function resetPosition(to: number): void {
    index = to;
    resumeAt = -1;
    lastWord = null;
    retries = 0;
  }

  function finish(): void {
    clearWatchdog();
    index = sentences.length;
    setStatus("ended");
    emit("end", undefined);
  }

  // Two ahead: one short sentence is not always enough time to synthesise a long one after it.
  function prefetch(): void {
    if (!driver.prepare) return;

    const last = Math.min(index + PREFETCH, sentences.length - 1);

    for (let i = index + 1; i <= last; i++) {
      const ahead = sentences[i];

      if (ahead) {
        driver.prepare({
          text: text.slice(ahead.start, ahead.end),
          lang,
          rate,
          voice,
        });
      }
    }
  }

  function speakCurrent(): void {
    const sentence = sentences[index];

    if (!sentence) {
      finish();
      return;
    }

    const from = Math.max(resumeAt, sentence.start);

    if (from === sentence.start) emitSentence();

    driver.speak(
      { text: text.slice(from, sentence.end), lang, rate, voice },
      {
        onStart() {
          armWatchdog(sentence.end - from);
        },

        onWord(charIndex, estimated = false) {
          const word = wordAt(sentence, from + charIndex);

          armWatchdog(sentence.end - (word?.start ?? from));

          if (!word || word === lastWord) return;

          lastWord = word;
          emit("word", {
            sentence: index,
            start: word.start,
            end: word.end,
            text: text.slice(word.start, word.end),
            estimated,
          });
        },

        onEnd() {
          clearWatchdog();

          const wait = pauseBefore(index + 1);

          resetPosition(index + 1);

          if (!wait) {
            speakCurrent();
            return;
          }

          gap = setTimeout(() => {
            gap = undefined;
            speakCurrent();
          }, wait);
        },

        onError: handleError,
      },
    );

    // Engines that synthesise first can take a while (or a download) before audio starts.
    if (!driver.slowStart) armWatchdog(sentence.end - from);

    prefetch();
  }

  // Re-speak the current sentence from the last word heard (or its start).
  function respeak(): void {
    halt();
    nativePaused = false;
    resumeAt = lastWord?.start ?? -1;

    if (status === "playing") speakCurrent();
  }

  function retryOrSkip(err: SpeechErrorInfo): void {
    if (retries++ < MAX_RETRIES) {
      respeak();
      return;
    }

    emit("error", err);
    resetPosition(index + 1);
    speakCurrent();
  }

  function onStall(): void {
    driver.cancel();
    retryOrSkip({
      code: "stalled",
      message: "Speech stopped responding; skipped a sentence.",
    });
  }

  function handleError(err: SpeechErrorInfo): void {
    clearWatchdog();
    resumeAt = lastWord?.start ?? -1;

    // Someone else cancelled speechSynthesis (another script, the OS); keep our place.
    if (err.code === "interrupted" || err.code === "canceled") {
      setStatus("paused");
      return;
    }

    // Autoplay policy: speech needs a user gesture. Keep the position so the next click resumes.
    if (err.code === "not-allowed") {
      emit("error", err);
      setStatus("idle");
      return;
    }

    retryOrSkip(err);
  }

  function seek(target: number): void {
    if (!sentences.length) return;

    halt();
    nativePaused = false;
    resetPosition(clampIndex(target));

    if (status === "playing") {
      speakCurrent();
      return;
    }

    emitSentence();

    if (status === "ended") setStatus("paused");
  }

  function resumeNative(): void {
    nativePaused = false;
    driver.resume();
    setStatus("playing");

    const s = sentences[index];

    if (s) armWatchdog(s.end - (lastWord?.start ?? s.start));
  }

  const player: Player = {
    play(from) {
      if (from !== undefined) {
        halt();
        nativePaused = false;
        resetPosition(clampIndex(from));
      } else if (status === "playing") {
        return;
      } else if (nativePaused) {
        resumeNative();
        return;
      } else if (index >= sentences.length) {
        resetPosition(0);
      }

      setStatus("playing");
      speakCurrent();
    },

    pause() {
      if (status !== "playing") return;

      if (driver.reliablePause && !gap) {
        clearWatchdog();
        driver.pause();
        nativePaused = true;
      } else {
        halt();
        resumeAt = lastWord?.start ?? -1;
      }

      setStatus("paused");
    },

    toggle() {
      if (status === "playing") player.pause();
      else player.play();
    },

    next() {
      if (index + 1 < sentences.length) {
        seek(index + 1);
        return;
      }

      halt();
      finish();
    },

    // Like a rewind button: back to the sentence start, or to the previous one when near the start.
    prev() {
      const sentence = sentences[index];
      const wellInto = sentence && lastWord && lastWord.start - sentence.start > REWIND_CHARS;

      seek(wellInto ? index : index - 1);
    },

    seek,

    setRate(next) {
      const clamped = clampRate(next);

      if (clamped === rate) return;

      rate = clamped;

      // Most engines fix an utterance's rate when it starts, so changes apply by re-speaking.
      if (driver.liveRate) driver.setRate?.(clamped);
      else if (status === "playing" || nativePaused) respeak();
    },

    setVoice(next) {
      if (next?.id === voice?.id) return;

      voice = next;

      if (status === "playing" || nativePaused) respeak();
    },

    getState() {
      return { status, index, rate, voice };
    },

    destroy() {
      halt();
      status = "idle";
    },
  };

  return player;
}
