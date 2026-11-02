import { useEffect, useRef, useState } from "preact/hooks";
import type { Reader } from "../reader/reader.types";
import { PlayIcon } from "./icons";
import { PLAY_HERE_HIDE_MS, PLAY_HERE_MAX_DISTANCE, PLAY_HERE_SIZE, SELECTION_SETTLE_MS } from "./ui.constants";
import type { Strings } from "./ui.i18n";
import { sameSpot, viewport } from "./ui.lib";
import type { Spot } from "./ui.types";

export type PlayHereProps = {
  reader: Reader;
  t: Strings;
  current: number | null;
  onPlay: (index: number) => void;
};

const PASSIVE = { passive: true };

function selectionSpot(reader: Reader): Spot | null {
  const index = reader.selectionSentence();

  if (index === null) return null;

  const rect = document.getSelection()?.getRangeAt(0).getBoundingClientRect();

  if (!rect) return null;

  const { width, height } = viewport();

  return {
    index,
    x: Math.min(Math.max(8, rect.left), width - 180),
    y: Math.min(rect.bottom + 10, height - 110),
  };
}

// A margin button beside the sentence under the mouse, and a chip under a selection (touch).
export function PlayHere(props: PlayHereProps) {
  const { reader, t, current, onPlay } = props;
  const [hover, setHover] = useState<Spot | null>(null);
  const [selection, setSelection] = useState<Spot | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    let frame = 0;
    let hideTimer = 0;
    let px = 0;
    let py = 0;
    let overButton = false;

    function hideSoon(): void {
      if (!hideTimer) {
        hideTimer = window.setTimeout(() => setHover(null), PLAY_HERE_HIDE_MS);
      }
    }

    function update(): void {
      frame = 0;

      if (overButton) return;

      const hit = reader.sentenceAtPoint(px, py);

      if (!hit || Math.abs(hit.rect.top + hit.rect.height / 2 - py) > PLAY_HERE_MAX_DISTANCE) {
        hideSoon();
        return;
      }

      clearTimeout(hideTimer);
      hideTimer = 0;

      const next = {
        index: hit.index,
        x: Math.max(4, hit.rect.left - PLAY_HERE_SIZE - 10),
        y: hit.rect.top + hit.rect.height / 2 - PLAY_HERE_SIZE / 2,
      };

      // Most frames land on the same sentence; skip those renders.
      setHover((prev) => (sameSpot(prev, next) ? prev : next));
    }

    function onMove(e: MouseEvent): void {
      overButton = !!button.current && e.composedPath().includes(button.current);
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(update);
    }

    function onScroll(): void {
      setHover(null);
    }

    document.addEventListener("mousemove", onMove, PASSIVE);
    window.addEventListener("scroll", onScroll, PASSIVE);

    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(hideTimer);
    };
  }, [reader]);

  useEffect(() => {
    let timer = 0;

    function onChange(): void {
      clearTimeout(timer);
      timer = window.setTimeout(() => setSelection(selectionSpot(reader)), SELECTION_SETTLE_MS);
    }

    function onScroll(): void {
      setSelection(null);
    }

    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, PASSIVE);

    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [reader]);

  function playHover(): void {
    if (!hover) return;

    onPlay(hover.index);
    setHover(null);
  }

  function playSelection(): void {
    if (!selection) return;

    onPlay(selection.index);
    setSelection(null);
  }

  const showHover = hover && hover.index !== current;

  return (
    <>
      <button
        ref={button}
        type="button"
        class={`here${showHover ? " on" : ""}`}
        style={hover ? { top: `${hover.y}px`, left: `${hover.x}px` } : { visibility: "hidden" }}
        aria-label={t.playFromHere}
        tabIndex={-1}
        onClick={playHover}
      >
        <PlayIcon size={14} />
      </button>

      {selection && (
        <button
          type="button"
          class="selchip surface"
          style={{ top: `${selection.y}px`, left: `${selection.x}px` }}
          // Keep the selection alive: a mousedown on a button would otherwise clear it first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={playSelection}
        >
          <span class="disc">
            <PlayIcon size={11} />
          </span>
          {t.playFromHere}
        </button>
      )}
    </>
  );
}
