// Readability-style heuristics, trimmed to what matters for picking one root on article pages.
export const POSITIVE_HINT = /article|body|content|entry|main|post|story|text|detail|isi|berita|artikel/i;
export const NEGATIVE_HINT =
  /comment|sidebar|widget|footer|masthead|menu|nav|related|popular|share|social|sponsor|promo|banner|breadcrumb|cookie|subscribe|newsletter|tags?\b|meta|author|byline|caption|gpt-ad|(?:^|[\s_-])(?:ads?|advert\w*)(?:$|[\s_-])/i;

export const MIN_PARAGRAPH = 25;
export const MIN_HINTED_BODY = 200;
// Direct text a <div> needs to count as a paragraph of its own (<br><br>-separated bodies).
export const MIN_BARE_TEXT = 80;
// Share of a paragraph's score given to its parent, grandparent and great-grandparent.
export const ANCESTOR_DIVIDERS = [1, 2, 6] as const;

export const TAG_WEIGHTS: Readonly<Record<string, number>> = {
  div: 5,
  article: 5,
  pre: 3,
  td: 3,
  blockquote: 3,
  ol: -3,
  ul: -3,
  dl: -3,
  li: -3,
  form: -3,
  h1: -5,
  h2: -5,
  h3: -5,
  h4: -5,
  h5: -5,
  h6: -5,
  th: -5,
};

const ADS = '.ad,.ads,.advert,.advertisement,.ad-slot,.adsbygoogle,[id^="div-gpt-ad"],[data-ad-unit],[data-ad-slot]';

// Never read aloud, even inside the article root.
export const BUILTIN_SKIP = [
  "[data-reader-skip]",
  'nav,aside,footer,[role="navigation"],[role="complementary"],[role="note"]',
  // Many CMSes mark captions and photo credits with classes instead of <figcaption>.
  'figure,figcaption,[class*="caption"],[class*="credit"]',
  ".sr-only,.screen-reader-text,.visually-hidden,.visuallyhidden",
  "script,style,noscript,template,iframe,object,embed,svg,math,canvas,video,audio",
  "button,select,textarea,input,form",
  // Code reads terribly aloud; publishers can still opt in with contentSelector on a <pre>.
  "pre",
  '[hidden],[aria-hidden="true"]',
  ADS,
].join(",");

// Inline cross-links ("Baca juga: ...") are standard on Indonesian portals.
export const READ_ALSO = /^\s*(baca juga|lihat juga|simak juga|read more|read also|see also|related)\s*:/i;

// Footnote markers ("[1]"). Added only where :has() parses: one bad selector voids the whole list.
export const FOOTNOTES = 'sup:has(> a[href^="#"])';

export const FLOATS = new Set(["left", "right", "inline-start", "inline-end"]);
