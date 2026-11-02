import { describe, expect, it } from "vitest";
import { createSkipMatcher } from "../extract/extract";
import { buildTextMap, indexAt, rangeFor } from "./textmap";

const mount = (html: string): HTMLElement => {
  document.body.innerHTML = `<div id="root">${html}</div>`;
  return document.getElementById("root") as HTMLElement;
};

describe("buildTextMap", () => {
  it("joins inline elements without inventing spaces", () => {
    const root = mount('<p>A <a href="#">link</a>ed <em>word</em>s here.</p>');
    expect(buildTextMap(root).text).toBe("A linked words here.");
  });

  it("collapses source whitespace like CSS does", () => {
    const root = mount("<p>\n    Lots   of\n\tspace   </p>");
    expect(buildTextMap(root).text).toBe("Lots of space");
  });

  it("separates blocks and <br> with a newline", () => {
    const root = mount("<h2>Heading</h2>\n<p>One.<br>Two.</p><ul><li>a</li><li>b</li></ul>");
    expect(buildTextMap(root).text).toBe("Heading\nOne.\nTwo.\na\nb");
  });

  it("breaks around a block nested between bare text", () => {
    const root = mount("<div>before<p>inside</p>after</div>");
    expect(buildTextMap(root).text).toBe("before\ninside\nafter");
  });

  it("skips excluded subtrees and keeps neighbouring words apart", () => {
    const root = mount(
      "<p>Keep<span data-reader-skip>drop</span>this.</p><figure><figcaption>Caption</figcaption></figure><p>End.</p>",
    );
    expect(buildTextMap(root, createSkipMatcher()).text).toBe("Keep this.\nEnd.");
  });

  it("keeps non-breaking spaces as characters", () => {
    const root = mount("<p>26&nbsp;°C</p>");
    expect(buildTextMap(root).text).toBe("26 °C");
  });

  it("never mutates the DOM", () => {
    const root = mount("<p>Some <b>bold</b>\n text.</p><aside>x</aside>");
    const before = root.innerHTML;
    buildTextMap(root, createSkipMatcher());
    expect(root.innerHTML).toBe(before);
  });
});

describe("rangeFor", () => {
  it("maps a slice back to the exact DOM text across inline elements", () => {
    const root = mount('<p>The   <a href="#">quick</a> <em>br</em>own fox.</p>');
    const map = buildTextMap(root);
    const start = map.text.indexOf("quick");
    expect(rangeFor(map, start, start + "quick brown".length)?.toString()).toBe("quick brown");
  });

  it("trims inserted separators from the edges", () => {
    const root = mount("<p>One.</p><p>Two.</p>");
    const map = buildTextMap(root);
    // text is 'One.\nTwo.'; index 4 is the inserted newline.
    expect(rangeFor(map, 3, 5)?.toString()).toBe(".");
    expect(rangeFor(map, 4, 6)?.toString()).toBe("T");
    expect(rangeFor(map, 4, 5)).toBeNull();
  });

  it("returns null instead of throwing when the DOM changed", () => {
    const root = mount("<p>Hello world</p>");
    const map = buildTextMap(root);
    (map.nodes[0] as Text).data = "Hi";
    expect(rangeFor(map, 6, 11)).toBeNull();
  });
});

describe("indexAt", () => {
  it("resolves a point inside a mapped text node", () => {
    const root = mount("<p>Alpha <b>beta</b> gamma</p>");
    const map = buildTextMap(root);
    const beta = root.querySelector("b")?.firstChild as Text;
    expect(indexAt(map, beta, 2)).toBe(map.text.indexOf("beta") + 2);
  });

  it("resolves an element boundary to the next mapped text", () => {
    const root = mount("<p>First.</p><p>Second.</p>");
    const map = buildTextMap(root);
    expect(indexAt(map, root, 1)).toBe(map.text.indexOf("Second"));
    expect(indexAt(map, root, 2)).toBe(map.text.length);
  });

  it("resolves a point in skipped text to the text that follows", () => {
    const root = mount("<p>Read <span data-reader-skip>skip me</span>on.</p>");
    const map = buildTextMap(root, createSkipMatcher());
    const skipped = root.querySelector("span")?.firstChild as Text;
    expect(indexAt(map, skipped, 3)).toBe(map.text.indexOf("on."));
  });
});
