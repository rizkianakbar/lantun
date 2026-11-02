import { beforeEach, describe, expect, it } from "vitest";
import {
  articleKey,
  clearPosition,
  findSavedPosition,
  loadSettings,
  savePosition,
  saveSettings,
} from "./reader.storage";

beforeEach(() => localStorage.clear());

describe("settings", () => {
  it("round-trips and sanitises", () => {
    saveSettings({ rate: 1.5, voices: { id: "Damayanti" } });
    expect(loadSettings()).toEqual({ rate: 1.5, voices: { id: "Damayanti" } });
    localStorage.setItem("lantun:settings", JSON.stringify({ rate: 99, voices: { en: 3, id: "x" } }));
    expect(loadSettings()).toEqual({ rate: 3, voices: { id: "x" } });
  });
});

describe("positions", () => {
  const texts = ["First one.", "Second one.", "Third one.", "Fourth one."];
  const key = "https://news.example/a";

  it("keys articles without tracking parameters", () => {
    const loc = { origin: "https://x.id", pathname: "/berita", search: "?p=12&utm_source=fb&fbclid=abc" };

    expect(articleKey(loc)).toBe("https://x.id/berita?p=12");
    expect(articleKey({ ...loc, search: "?utm_medium=x" })).toBe("https://x.id/berita");
  });

  it("finds a saved sentence again, even after the article shifts", () => {
    const shifted = ["New intro.", ...texts];

    savePosition(key, 2, 4, "  THIRD\n one. ");
    expect(findSavedPosition(key, (i) => texts[i] as string, 4)).toBe(2);
    expect(findSavedPosition(key, (i) => shifted[i] as string, 5)).toBe(3);
    expect(findSavedPosition(key, () => "other", 4)).toBeNull();
  });

  it("clears and prunes old entries", () => {
    savePosition(key, 1, 4, "x");
    clearPosition(key);
    expect(findSavedPosition(key, () => "x", 4)).toBeNull();

    for (let i = 0; i < 50; i++) savePosition(`k${i}`, 1, 2, "x");

    expect(Object.keys(JSON.parse(localStorage.getItem("lantun:positions") ?? "{}"))).toHaveLength(40);
  });
});
