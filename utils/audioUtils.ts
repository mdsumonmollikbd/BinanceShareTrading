/**
 * Decodes a base64 string into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a base64 string.
 */
export function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts raw PCM Int16 data (from Gemini) to an AudioBuffer (for Web Audio API).
 * Gemini sends 24kHz mono by default for output.
 */
export function pcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer {
  // Ensure we have an even number of bytes for Int16Array
  let alignedData = data;
  if (data.byteLength % 2 !== 0) {
    alignedData = data.slice(0, data.byteLength - 1);
  }

  const dataInt16 = new Int16Array(alignedData.buffer);
  const frameCount = dataInt16.length / numChannels;
  
  // Prevent empty buffer creation
  if (frameCount === 0) {
      return ctx.createBuffer(numChannels, 1, sampleRate);
  }

  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts Float32 audio data (from Microphone) to Int16 PCM format (for Gemini).
 * Multiplies by 32768 to map -1..1 range to Int16 range.
 */
export function float32ToInt16Pcm(float32Data: Float32Array): Int16Array {
  const int16Data = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Data;
}