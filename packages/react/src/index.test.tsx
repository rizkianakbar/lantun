import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LantunWidget } from "./index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hosts = () => document.querySelectorAll("lantun-reader").length;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<LantunWidget />", () => {
  it("mounts the widget once, even under StrictMode, and removes it on unmount", () => {
    document.body.innerHTML = '<article><p>Some article text to read.</p></article><div id="app"></div>';
    const root = createRoot(document.getElementById("app") as HTMLElement);
    act(() =>
      root.render(
        <StrictMode>
          <LantunWidget contentSelector="article" color="#e11d48" />
        </StrictMode>,
      ),
    );
    expect(hosts()).toBe(1);
    act(() => root.unmount());
    expect(hosts()).toBe(0);
  });

  it("re-initialises when options change, not on every render", () => {
    document.body.innerHTML = '<article><p>Text.</p></article><div id="app"></div>';
    const root = createRoot(document.getElementById("app") as HTMLElement);
    act(() => root.render(<LantunWidget position="bottom-right" />));
    const first = document.querySelector("lantun-reader");
    act(() => root.render(<LantunWidget position="bottom-right" />));
    expect(document.querySelector("lantun-reader")).toBe(first);
    act(() => root.render(<LantunWidget position="bottom-left" />));
    expect(document.querySelector("lantun-reader")).not.toBe(first);
    expect(hosts()).toBe(1);
    act(() => root.unmount());
  });
});
