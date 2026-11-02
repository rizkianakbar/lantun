import { useRef } from "preact/hooks";
import { MASK_BAND } from "./ui.constants";
import { usePointerY } from "./ui.hooks";
import { viewport } from "./ui.lib";

export function ReadingGuide() {
  const ref = useRef<HTMLDivElement>(null);

  usePointerY((y) => {
    if (ref.current) ref.current.style.transform = `translateY(${y}px)`;
  });

  return <div class="guide" ref={ref} aria-hidden="true" />;
}

export function ReadingMask() {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Both shades are viewport-tall and only translated: no layout work per frame.
  usePointerY((y) => {
    if (top.current) top.current.style.transform = `translateY(${y - MASK_BAND - viewport().height}px)`;
    if (bottom.current) bottom.current.style.transform = `translateY(${y + MASK_BAND}px)`;
  });

  return (
    <>
      <div class="shade" ref={top} aria-hidden="true" />
      <div class="shade" ref={bottom} aria-hidden="true" />
    </>
  );
}
