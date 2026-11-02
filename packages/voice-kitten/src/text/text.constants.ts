export const PUNCT = `[${';:,.!?¡¿—…"«»“”()[]{}'.replace(/[\]\\[^-]/g, "\\$&")}]`;

// Symbol order is the model's vocabulary: an index here is a token id.
export const SYMBOLS = [
  "$",
  ...';:,.!?¡¿—…"«»"" ',
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  ..."ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ",
];
// Later duplicates win, as in the Python dict this mirrors.
export const IDS = new Map(SYMBOLS.map((s, i) => [s, i]));
export const SYMBOL_COUNT = SYMBOLS.length;

// Python's re.findall(r"\w+|[^\w\s]") with Unicode \w, then joined by spaces.
export const TOKENS = /[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu;
// A word's leading punctuation, its pronounceable core, and its trailing punctuation.
export const EDGES = new RegExp(`^(${PUNCT}*)(.*?)(${PUNCT}*)$`, "su");
export const SPACE = IDS.get(" ") as number;
