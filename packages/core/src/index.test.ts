import { afterEach, describe, expect, it, vi } from "vitest";
import { destroy, init, isInitialized } from "./index";

afterEach(() => {
  destroy();
  vi.restoreAllMocks();
});

describe("public API boundary", () => {
  it("warns instead of initialising twice", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    init();
    init();
    expect(isInitialized()).toBe(true);
    expect(spy).toHaveBeenCalledWith("[Lantun]", expect.stringContaining("init() called twice"));
  });

  it("never throws into the host page", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = {
      get contentSelector(): string {
        throw new Error("boom");
      },
    };
    expect(() => init(bad)).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});

describe("destroy()", () => {
  it("removes every element, style and ax- class the widget added", () => {
    document.body.innerHTML = "<article><p>Some text to read here.</p></article>";
    localStorage.setItem("lantun:ax", JSON.stringify({ contrast: "dark", links: true }));
    init({ contentSelector: "article" });
    expect(document.querySelector("lantun-reader")).not.toBeNull();
    expect(document.documentElement.classList.contains("ax-contrast-dark")).toBe(true);
    destroy();
    expect(document.querySelector("lantun-reader, lantun-overlay")).toBeNull();
    expect(document.querySelector("#lantun-ax, #lantun-highlight")).toBeNull();
    expect(Array.from(document.documentElement.classList).filter((c) => c.startsWith("ax-"))).toEqual([]);
    localStorage.clear();
  });
});

describe("init() failure", () => {
  it("rolls back completely so init can be retried", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ui = await import("./ui/mount");
    const mount = vi.spyOn(ui, "mountUI").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    localStorage.setItem("lantun:ax", JSON.stringify({ links: true }));
    init();
    expect(isInitialized()).toBe(false);
    expect(document.documentElement.classList.contains("ax-links")).toBe(false);
    expect(spy).toHaveBeenCalled();
    mount.mockRestore();
    init();
    expect(isInitialized()).toBe(true);
    destroy();
    localStorage.clear();
  });
});
