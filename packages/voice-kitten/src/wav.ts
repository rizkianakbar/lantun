// 16-bit mono WAV, so clips can play through an <audio> element, which can change speed
// without changing pitch (Web Audio buffers cannot).
export const encodeWav = (
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer => {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const ascii = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++)
    v.setInt16(
      44 + i * 2,
      Math.max(-1, Math.min(1, samples[i] ?? 0)) * 0x7fff,
      true,
    );
  return buf;
};

// A few milliseconds of silence, played inside the reader's click so the <audio> element is
// allowed to play later, when synthesis finishes (Safari's autoplay rule is per element).
export const SILENCE = `data:audio/wav;base64,${btoa(String.fromCharCode(...new Uint8Array(encodeWav(new Float32Array(240), 24000))))}`;
