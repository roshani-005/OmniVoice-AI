import { config } from "../config.js";

/**
 * Basic mu-law (G.711u) to 16-bit Linear PCM conversion table
 */
const ULAW_TO_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const ulaw = ~i;
  const sign = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  let sample = ((mantissa << 3) + 132) << exponent;
  sample -= 132;
  ULAW_TO_PCM[i] = sign !== 0 ? -sample : sample;
}

export class AudioProcessor {
  /**
   * Decode Base64 mu-law audio frame to 16-bit linear PCM samples
   */
  static decodeUlawBase64(base64Payload: string): Int16Array {
    const buffer = Buffer.from(base64Payload, "base64");
    const pcm = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      pcm[i] = ULAW_TO_PCM[buffer[i]];
    }
    return pcm;
  }

  /**
   * Calculate Root Mean Square (RMS) frame energy for Voice Activity Detection (VAD)
   */
  static calculateFrameEnergy(samples: Int16Array): number {
    if (samples.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
    }
    return Math.sqrt(sumSquares / samples.length);
  }

  /**
   * Simple Energy-based Voice Activity Detection
   * Threshold: Energy > 350 indicates speech activity
   */
  static isSpeechActive(samples: Int16Array, threshold = 350): boolean {
    const energy = this.calculateFrameEnergy(samples);
    return energy > threshold;
  }

  /**
   * Simulated TTS audio chunk generator (produces valid base64 audio frames for VoIP playback)
   */
  static generateTtsAudioFrames(durationMs: number = 500, sampleRate = 8000): string[] {
    const numSamples = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = Buffer.alloc(numSamples);
    
    // Generate a gentle synthetic audio sine tone wave (440Hz / dial-tone voice response)
    const frequency = 440;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const val = Math.sin(2 * Math.PI * frequency * t);
      // Map to 8-bit unsigned
      buffer[i] = Math.floor((val + 1) * 127.5);
    }

    // Split into 20ms audio frames (160 bytes each for 8kHz G.711)
    const frameSize = 160;
    const frames: string[] = [];
    for (let i = 0; i < buffer.length; i += frameSize) {
      const slice = buffer.subarray(i, Math.min(i + frameSize, buffer.length));
      frames.push(slice.toString("base64"));
    }
    return frames;
  }
}
