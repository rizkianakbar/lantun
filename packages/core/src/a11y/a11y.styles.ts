// The one global stylesheet the widget adds. Every rule is scoped under an html.ax-* class, so it
// is inert until the reader turns a setting on.

const TEXT = "p,li,dt,dd,blockquote,figcaption,caption,td,th,label,legend,summary,pre,h1,h2,h3,h4,h5,h6";
// Icon fonts render glyphs from ligatures or private-use characters; changing their font or
// spacing turns icons into gibberish.
const ICONS =
  'i,svg,svg *,[class*="icon"],[class*="fa-"],[class^="fa "],.material-icons,.material-symbols-outlined,.dashicons,[aria-hidden="true"]';
const MEDIA = "img,picture,video,canvas,iframe,svg,svg *,object,embed";
const OURS = "lantun-reader,lantun-overlay";
const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
const DYSLEXIC_SRC = "https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.3.0/files/opendyslexic-latin";

const CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M9 5v34l9-8 6 13 7-3-6-13h12z' fill='%23000' stroke='%23fff' stroke-width='2.5' stroke-linejoin='round'/%3E%3C/svg%3E\") 9 5,auto";

function scale(n: number, z: number): string {
  return `html.ax-text-${n} :is(${TEXT}):not(:is(${TEXT}) *){zoom:${z}}`;
}
function line(n: number, v: number): string {
  return `html.ax-line-${n} body :is(${TEXT}){line-height:${v}!important}`;
}
function spacing(n: number, l: number): string {
  return `html.ax-spacing-${n} body *:not(${ICONS}){letter-spacing:${l}em!important;word-spacing:${l * 2}em!important}`;
}

export const AX_CSS = [
  // Our crossfade between looks (controller.ts): short, and never in the way of the next click.
  "html.ax-morph::view-transition{pointer-events:none}",
  "html.ax-morph::view-transition-old(root),html.ax-morph::view-transition-new(root){animation-duration:.22s;animation-timing-function:cubic-bezier(.2,.8,.2,1)}",
  // The widget is its own layer (mount.tsx names it) and holds still: only the page changes.
  "html.ax-morph::view-transition-old(lantun-ui){display:none}",
  "html.ax-morph::view-transition-group(lantun-ui),html.ax-morph::view-transition-new(lantun-ui){animation:none}",
  // Zoom on the outermost text blocks only: scales px-based themes (where font-size on <html>
  // does nothing) without compounding on nested blocks like li > p.
  scale(115, 1.15),
  scale(130, 1.3),
  scale(150, 1.5),
  line(1, 1.75),
  line(2, 2.05),
  line(3, 2.4),
  spacing(1, 0.05),
  spacing(2, 0.1),
  spacing(3, 0.16),

  `html.ax-font-readable body *:not(${ICONS}){font-family:${SANS}!important}`,
  // Declared always, downloaded only once a matching element exists: zero network until toggled.
  `@font-face{font-family:"OpenDyslexic";src:url(${DYSLEXIC_SRC}-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}`,
  `@font-face{font-family:"OpenDyslexic";src:url(${DYSLEXIC_SRC}-700-normal.woff2) format("woff2");font-weight:700;font-display:swap}`,
  `html.ax-font-dyslexic body *:not(${ICONS}){font-family:"OpenDyslexic",${SANS}!important}`,

  // Filters compose through custom properties so dark/invert and desaturate can stack.
  `html.ax-contrast-dark{--ax-invert:invert(1) hue-rotate(180deg);background-color:#fff!important}`,
  `html.ax-contrast-invert{--ax-invert:invert(1);background-color:#fff!important}`,
  `html.ax-desaturate{--ax-gray:grayscale(1)}`,
  `html:is(.ax-contrast-dark,.ax-contrast-invert,.ax-desaturate){filter:var(--ax-invert,) var(--ax-gray,)!important}`,
  // Dark mode is a "smart invert": photos and video are flipped back to their real colours.
  `html.ax-contrast-dark :is(img,video,canvas,iframe,svg image,[style*="background-image"]):not(picture *){filter:invert(1) hue-rotate(180deg)!important}`,
  `html.ax-contrast-dark :is(${OURS}){filter:invert(1) hue-rotate(180deg)!important}`,
  `html.ax-contrast-invert :is(${OURS}){filter:invert(1)!important}`,

  `html.ax-contrast-light body,html.ax-contrast-light body *:not(${MEDIA}){background-color:#fff!important;color:#141414!important;border-color:#c4c4c4!important;text-shadow:none!important}`,
  `html.ax-contrast-light body a[href],html.ax-contrast-light body a[href] *{color:#0b57d0!important}`,
  `html.ax-contrast-high body,html.ax-contrast-high body *:not(${MEDIA}){background-color:#000!important;background-image:none!important;color:#fff!important;border-color:#fff!important;text-shadow:none!important;box-shadow:none!important}`,
  `html.ax-contrast-high body a[href],html.ax-contrast-high body a[href] *{color:#ffe14d!important;text-decoration:underline!important}`,

  `html.ax-links body a[href]{text-decoration:underline!important;text-decoration-thickness:2px!important;text-underline-offset:3px!important;outline:2px solid #e8a200!important;outline-offset:2px!important;background-color:#fff4c2!important;color:#111!important}`,
  `html.ax-links body a[href] *{color:#111!important}`,

  `html.ax-cursor,html.ax-cursor *{cursor:${CURSOR}!important}`,

  `html.ax-still *,html.ax-still *::before,html.ax-still *::after{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}`,

  `html.ax-no-images :is(img,picture,video,canvas,[role="img"]){visibility:hidden!important}`,
  `html.ax-no-images body *:not(${OURS}){background-image:none!important}`,
].join("\n");
