import { describe, expect, it } from "vitest";
import { optionsFromDataset } from "./dataset";

const ds = (attrs: Record<string, string>): DOMStringMap => {
  const el = document.createElement("script");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(`data-${k}`, v);
  return el.dataset;
};

describe("optionsFromDataset", () => {
  it("reads the documented attributes", () => {
    expect(
      optionsFromDataset(
        ds({
          "content-selector": "article",
          "exclude-selectors": ".ad, .related ,",
          position: "bottom-left",
          color: "#ff0000",
          lang: "id",
          tts: "false",
          "z-index": "99",
        }),
      ),
    ).toEqual({
      contentSelector: "article",
      excludeSelectors: [".ad", ".related"],
      position: "bottom-left",
      color: "#ff0000",
      lang: "id",
      features: { tts: false, a11y: undefined },
      zIndex: 99,
    });
  });

  it("returns no options for a bare tag", () => {
    expect(optionsFromDataset(ds({}))).toEqual({});
  });

  it("ignores a non-numeric z-index", () => {
    expect(optionsFromDataset(ds({ "z-index": "top" })).zIndex).toBeUndefined();
  });
});
