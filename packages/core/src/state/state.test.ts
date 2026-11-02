import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  articleKey,
  clearPosition,
  findSavedPosition,
  fingerprint,
  savePosition,
} from "./positions";
import { loadSettings, saveSettings } from "./settings";
import { readJson, writeJson } from "./storage";
import { createStore } from "./store";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("namespaces keys and survives corrupt JSON", () => {
    writeJson("x", { a: 1 });
    expect(localStorage.getItem("lantun:x")).toBe('{"a":1}');
    localStorage.setItem("lantun:x", "{nope");
    expect(readJson("x")).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => writeJson("x", 1)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("createStore", () => {
  it("notifies only on real changes", () => {
    const s = createStore({ a: 1, b: "x" });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ a: 1 });
    expect(fn).not.toHaveBeenCalled();
    s.set({ a: 2 });
    expect(fn).toHaveBeenCalledWith({ a: 2, b: "x" });
  });
});

describe("settings", () => {
  it("round-trips and sanitises", () => {
    saveSettings({ rate: 1.5, voices: { id: "Damayanti" } });
    expect(loadSettings()).toEqual({ rate: 1.5, voices: { id: "Damayanti" } });
    localStorage.setItem(
      "lantun:settings",
      JSON.stringify({ rate: 99, voices: { en: 3, id: "x" } }),
    );
    expect(loadSettings()).toEqual({ rate: 3, voices: { id: "x" } });
  });
});

describe("positions", () => {
  const texts = ["First one.", "Second one.", "Third one.", "Fourth one."];
  const key = "https://news.example/a";

  it("keys articles without tracking parameters", () => {
    const loc = {
      origin: "https://x.id",
      pathname: "/berita",
      search: "?p=12&utm_source=fb&fbclid=abc",
    };
    expect(articleKey(loc)).toBe("https://x.id/berita?p=12");
    expect(articleKey({ ...loc, search: "?utm_medium=x" })).toBe(
      "https://x.id/berita",
    );
  });

  it("finds a saved sentence again, even after the article shifts", () => {
    savePosition(key, 2, 4, texts[2] as string);
    expect(findSavedPosition(key, (i) => texts[i] as string, 4)).toBe(2);
    const shifted = ["New intro.", ...texts];
    expect(findSavedPosition(key, (i) => shifted[i] as string, 5)).toBe(3);
    expect(findSavedPosition(key, () => "other", 4)).toBeNull();
  });

  it("clears and prunes old entries", () => {
    savePosition(key, 1, 4, "x");
    clearPosition(key);
    expect(findSavedPosition(key, () => "x", 4)).toBeNull();
    for (let i = 0; i < 50; i++) savePosition(`k${i}`, 1, 2, "x");
    expect(
      Object.keys(JSON.parse(localStorage.getItem("lantun:positions") ?? "{}")),
    ).toHaveLength(40);
  });

  it("fingerprints ignore whitespace and case", () => {
    expect(fingerprint("  Hello\n  World ")).toBe(fingerprint("hello world"));
  });
});
