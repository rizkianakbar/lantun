import { beforeEach, describe, expect, it, vi } from "vitest";
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
    const store = createStore({ a: 1, b: "x" });
    const listener = vi.fn();

    store.subscribe(listener);
    store.set({ a: 1 });
    expect(listener).not.toHaveBeenCalled();
    store.set({ a: 2 });
    expect(listener).toHaveBeenCalledWith({ a: 2, b: "x" });
  });
});
