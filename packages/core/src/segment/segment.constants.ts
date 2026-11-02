// Intl.Segmenter splits "Dr. Andini" into two sentences. These abbreviations almost always precede a
// word; ones that often end a sentence (etc., dll., Inc.) are left out, since a wrong merge is worse.
const TITLES = "Mr|Mrs|Ms|Mx|Dr|dr|drg|Prof|Ir|Hj|KH|Bpk|Sdr|Sdri|Yth|yth|Gen|Gov|Sen|Rep|Lt|Col|Capt|Sgt|Rev|Hon";
const PLACES = "St|Mt|Ft|Jl|Jln|Kec|Kab|Kel|Prov";
const MONTHS = "Jan|Feb|Mar|Apr|Jun|Jul|Aug|Agu|Agt|Sep|Sept|Oct|Okt|Nov|Dec|Des";
const OTHER = "No|Nos|Vol|vs|Fig|Tbk|translit|lit|e\\.g|i\\.e|a\\.n|s\\.d";

// A single capital letter covers initials: "J. Mensah", "H. Agus Salim".
export const ENDS_WITH_ABBREVIATION = new RegExp(
  `(?:^|[\\s(“"'‘])(?:${TITLES}|${PLACES}|${MONTHS}|${OTHER}|\\p{Lu})\\.$`,
  "u",
);

// Fallbacks for engines without Intl.Segmenter (Firefox < 125). Good enough for id/en.
// A terminator directly followed by a letter or digit is not a break: "12.00", "Rp90.000", "e.g".
export const FALLBACK_SENTENCE = /(?:[^.!?…\n]|[.!?…](?=[\p{L}\p{N}]))+(?:[.!?…]+["'”’)\]]*)?/gu;
export const FALLBACK_WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}]|['’.-](?=[\p{L}\p{N}]))*/gu;
export const CLAUSE = /[,;:–—]/;

// Chrome's network voices stop after ~15 s of continuous speech; 200 characters is about 13 s at 1x.
export const MAX_SENTENCE_LENGTH = 200;
