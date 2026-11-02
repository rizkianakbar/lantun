// Android has reported Indonesian as the legacy Java code "in", and uses "_" as a separator.
export const LEGACY = new Map([
  ["in", "id"],
  ["iw", "he"],
  ["ji", "yi"],
]);

// macOS ships novelty voices ("Bubbles", "Zarvox") that nobody wants reading the news.
export const NOVELTY =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Deranged|Hysterical)\b/;
// Formant-era voices that sound robotic.
export const ROBOTIC = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Fred|Junior|Ralph|Kathy|Princess)\b/;
// Neural voices: Edge "Online (Natural)", Apple downloadable "Premium"/"Enhanced".
export const NEURAL = /\b(Natural|Neural|Premium|Enhanced)\b/i;
// Classic Windows SAPI desktop voices ("Microsoft David - English").
export const SAPI = /^Microsoft\s(?!.*\bOnline\b)/;
// Chrome's server-side voices, smoother than the compact macOS voices Chrome otherwise gets.
export const GOOGLE = /^Google\s/;
