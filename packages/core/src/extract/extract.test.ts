import { afterEach, describe, expect, it, vi } from "vitest";
import { createSkipMatcher, detectArticleRoot, findArticleRoot } from "./extract";

const para = (n: number, words = "Some reasonably long sentence, with a comma, about nothing much at all.") =>
  Array.from({ length: n }, () => `<p>${words}</p>`).join("");

afterEach(() => vi.restoreAllMocks());

describe("detectArticleRoot", () => {
  it("prefers the paragraph-heavy container over sidebars and comments", () => {
    document.body.innerHTML = `
      <nav>${para(2)}</nav>
      <div class="content"><div id="story">${para(6)}</div></div>
      <div class="sidebar">${para(3)}</div>
      <section class="comments">${para(4)}</section>`;
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("story");
  });

  it('uses itemprop="articleBody" when present', () => {
    document.body.innerHTML = `<div id="big">${para(10)}</div><div itemprop="articleBody" id="hint">${para(3)}</div>`;
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("hint");
  });

  it("handles <br>-separated bodies with no <p>", () => {
    const line = "A line of article text that is long enough to count as a paragraph on its own, really.";
    document.body.innerHTML = `<div id="body">${line}<br><br>${line}<br><br>${line}</div><div class="menu">x</div>`;
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("body");
  });

  it("penalises link lists", () => {
    const links = Array.from(
      { length: 8 },
      () => '<p><a href="#">A headline that is long enough to count as text, sure</a></p>',
    ).join("");
    document.body.innerHTML = `<div id="links">${links}</div><div id="article">${para(4)}</div>`;
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("article");
  });

  it("falls back to <article>, then <main>, then body", () => {
    document.body.innerHTML = '<main id="m"><article id="a"><p>short</p></article></main>';
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("a");
    document.body.innerHTML = '<main id="m"><p>short</p></main>';
    expect(detectArticleRoot(document, createSkipMatcher())?.id).toBe("m");
    document.body.innerHTML = "<p>short</p>";
    expect(detectArticleRoot(document, createSkipMatcher())).toBe(document.body);
  });
});

describe("findArticleRoot", () => {
  it("uses contentSelector when it matches", () => {
    document.body.innerHTML = `<div id="x"><p>tiny</p></div><div>${para(6)}</div>`;
    expect(findArticleRoot(document, "#x", createSkipMatcher())?.id).toBe("x");
  });

  it("warns and auto-detects when contentSelector is missing or invalid", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    document.body.innerHTML = `<div id="story">${para(4)}</div>`;
    expect(findArticleRoot(document, ".nope", createSkipMatcher())?.id).toBe("story");
    expect(findArticleRoot(document, "[[bad", createSkipMatcher())?.id).toBe("story");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("createSkipMatcher", () => {
  it("ignores invalid exclude selectors with a warning", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const skip = createSkipMatcher([".ok", "[[bad", ""]);
    document.body.innerHTML = '<p class="ok">x</p><p>y</p>';
    const [ok, plain] = Array.from(document.querySelectorAll("p"));
    expect(skip(ok as Element)).toBe(true);
    expect(skip(plain as Element)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skips "Baca juga" / "Read more" cross-links', () => {
    const skip = createSkipMatcher();
    document.body.innerHTML =
      "<p><strong>Baca juga:</strong> <a>Judul</a></p><p>Read more: x</p><p>Baca juga buku ini.</p>";
    expect(Array.from(document.querySelectorAll("p"), (p) => skip(p))).toEqual([true, true, false]);
  });
});

describe("built-in skips for reference sites", () => {
  it("skips notes, figures, floated tables and footnote markers", () => {
    document.body.innerHTML = `<div id="r">
      <div role="note">For other uses, see X.</div>
      <table style="float:right"><tr><td>Infobox</td></tr></table>
      <figure><audio></audio><div>Duration: 44 seconds.</div><figcaption>Caption</figcaption></figure>
      <p>Speech synthesis is artificial speech.<sup><a href="#n1">[1]</a></sup> It is old.<span class="sr-only">Duration:</span></p>
      <div class="caption">A photo. <span class="credit">AP</span></div>
      <table><tr><td>Data cell</td></tr></table>
    </div>`;
    const skip = createSkipMatcher();
    const kept = Array.from(document.querySelectorAll("#r *"))
      .filter((el) => !skip(el))
      .map((el) => el.localName);
    expect(kept).not.toContain("figure");
    expect(skip(document.querySelector('[role="note"]') as Element)).toBe(true);
    expect(skip(document.querySelector(".sr-only") as Element)).toBe(true);
    expect(skip(document.querySelector(".caption") as Element)).toBe(true);
    expect(skip(document.querySelector("table") as Element)).toBe(true);
    expect(skip(document.querySelectorAll("table")[1] as Element)).toBe(false);
  });
});
