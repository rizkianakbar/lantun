import { afterEach, describe, expect, it } from "vitest";
import { optionsFromDataset, resolveOptions } from "./options";
import { DEFAULT_COLOR, DEFAULT_Z_INDEX } from "./options.constants";

afterEach(() => {
  document.documentElement.lang = "";
});

function dataset(attrs: Record<string, string>): DOMStringMap {
  const el = document.createElement("script");

  for (const [k, v] of Object.entries(attrs)) el.setAttribute(`data-${k}`, v);

  return el.dataset;
}

describe("resolveOptions", () => {
  it("applies spec defaults, taking lang from <html lang>", () => {
    document.documentElement.lang = "id";
    expect(resolveOptions({})).toEqual({
      contentSelector: null,
      excludeSelectors: [],
      position: "right",
      color: DEFAULT_COLOR,
      lang: "id",
      features: { tts: true, a11y: true },
      zIndex: DEFAULT_Z_INDEX,
      nonce: null,
    });
  });

  it("maps bottom-* positions to their edge and rejects unknown ones", () => {
    expect(resolveOptions({ position: "bottom-left" }).position).toBe("left");
    expect(resolveOptions({ position: "bottom-right" }).position).toBe("right");
    // Data attributes are untyped strings, so bad values do reach this at runtime.
    expect(resolveOptions({ position: "top" as never }).position).toBe("right");
  });
});

describe("optionsFromDataset", () => {
  it("reads the documented attributes", () => {
    const opts = optionsFromDataset(
      dataset({
        "content-selector": "article",
        "exclude-selectors": ".ad, .related ,",
        position: "bottom-left",
        color: "#ff0000",
        lang: "id",
        tts: "false",
        "z-index": "99",
      }),
    );

    expect(opts).toEqual({
      contentSelector: "article",
      excludeSelectors: [".ad", ".related"],
      position: "bottom-left",
      color: "#ff0000",
      lang: "id",
      features: { tts: false, a11y: undefined },
      zIndex: 99,
    });
    expect(optionsFromDataset(dataset({ "z-index": "top" })).zIndex).toBeUndefined();
  });
});
