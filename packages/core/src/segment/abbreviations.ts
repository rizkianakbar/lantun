// Intl.Segmenter breaks after "Dr." when the next word is capitalised (UAX #29 has no abbreviation
// list), so "Dr. Andini" becomes two sentences. These are abbreviations that almost always precede
// another word. Ones that often end a sentence (etc., dll., Inc., a.m.) are left out on purpose:
// a missed merge only costs a pause, a wrong merge glues two sentences together.
const TITLES = 'Mr|Mrs|Ms|Mx|Dr|dr|drg|Prof|Ir|Hj|KH|Bpk|Sdr|Sdri|Yth|yth|Gen|Gov|Sen|Rep|Lt|Col|Capt|Sgt|Rev|Hon'
const PLACES = 'St|Mt|Ft|Jl|Jln|Kec|Kab|Kel|Prov'
const MONTHS = 'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Agu|Agt|Sep|Sept|Oct|Okt|Nov|Dec|Des'
const OTHER = 'No|Nos|Vol|vs|Fig|Tbk|translit|lit|e\\.g|i\\.e|a\\.n|s\\.d'

// A single capital letter covers initials: "J. Mensah", "H. Agus Salim".
export const ENDS_WITH_ABBREVIATION = new RegExp(
  `(?:^|[\\s(“"'‘])(?:${TITLES}|${PLACES}|${MONTHS}|${OTHER}|\\p{Lu})\\.$`,
  'u',
)
