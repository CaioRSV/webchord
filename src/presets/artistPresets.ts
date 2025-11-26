// Artist-inspired presets based on extensive research
// Each preset is carefully crafted to match the artist's signature sound

export interface ArtistPreset {
  id: string;
  name: string;
  artist: string;
  description: string;
  genre: string;
  bpm: number;
  key: string;
  globalOctave: number;
  masterVolume: number;
  waveform: 'sine' | 'sawtooth' | 'square' | 'triangle' | 'fm' | 'piano';
  adsr: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter: {
    cutoff: number;
    resonance: number;
    mode: 0 | 1 | 2; // 0: Lowpass, 1: Highpass, 2: Bandpass
    enabled: boolean;
  };
  lfo: {
    rate: number;
    depth: number;
    waveform: 0 | 1 | 2 | 3; // 0: Sine, 1: Triangle, 2: Square, 3: Sample & Hold
    target: 'pitch' | 'filter' | 'amplitude' | 'pan';
    enabled: boolean;
  };
  detune: number;
  effects: {
    glide: { enabled: boolean; time: number };
    tremolo: { enabled: boolean; rate: number; depth: number };
    flanger: { enabled: boolean; depth: number; rate: number; feedback: number; mix: number };
    delay: { enabled: boolean; time: number; feedback: number; mix: number };
    reverb: { enabled: boolean; size: number; damping: number; mix: number };
  };
}

export const artistPresets: ArtistPreset[] = [
  {
    id: 'oneheart',
    name: 'Oneheart - Ethereal Ambient',
    artist: 'oneheart',
    description: 'Slow, melancholic ambient pads with spacious reverb and soft piano tones',
    genre: 'Ambient / Lo-fi',
    bpm: 65,
    key: 'A',
    globalOctave: 3,
    masterVolume: 0.7,
    waveform: 'sine',
    adsr: {
      attack: 0.020, // Reduced from 0.4 to be more responsive while keeping ambient feel
      decay: 0.3,
      sustain: 0.85,
      release: 1.0,
    },
    filter: {
      cutoff: 1500,
      resonance: 0.3,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.4,
      depth: 200,
      waveform: 0, // Sine
      target: 'filter',
      enabled: true,
    },
    detune: 8,
    effects: {
      glide: { enabled: true, time: 80 }, // Reduced from 250ms to 80ms for better response
      tremolo: { enabled: false, rate: 3, depth: 0.3 },
      flanger: { enabled: false, depth: 0.3, rate: 0.5, feedback: 0.2, mix: 0.2 },
      delay: { enabled: true, time: 0.3, feedback: 0.25, mix: 0.15 },
      reverb: { enabled: true, size: 0.35, damping: 0.5, mix: 0.15 },
    },
  },

  {
    id: 'skeler',
    name: 'Skeler - Dark Wave',
    artist: 'Skeler',
    description: 'Energetic wave music with heavy bass, sidechain-like pumping, and atmospheric synths',
    genre: 'Wave / Hardwave',
    bpm: 145,
    key: 'D',
    globalOctave: 2,
    masterVolume: 0.85,
    waveform: 'sawtooth',
    adsr: {
      attack: 0.02,
      decay: 0.15,
      sustain: 0.7,
      release: 0.4,
    },
    filter: {
      cutoff: 2500,
      resonance: 0.6,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 4.8,
      depth: 400,
      waveform: 2, // Square (for sidechain-like pumping)
      target: 'filter',
      enabled: true,
    },
    detune: -5,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: true, rate: 8, depth: 0.4 },
      flanger: { enabled: false, depth: 0.4, rate: 1.2, feedback: 0.3, mix: 0.25 },
      delay: { enabled: true, time: 0.375, feedback: 0.3, mix: 0.25 },
      reverb: { enabled: true, size: 0.55, damping: 0.65, mix: 0.3 },
    },
  },

  {
    id: 'eevee',
    name: 'Eevee - Lo-fi Hip Hop',
    artist: 'Eevee',
    description: 'Warm, nostalgic lo-fi beats with jazzy chords and vinyl crackle vibes',
    genre: 'Lo-fi Hip Hop',
    bpm: 75,
    key: 'F',
    globalOctave: 3,
    masterVolume: 0.65,
    waveform: 'piano',
    adsr: {
      attack: 0.01,
      decay: 0.25,
      sustain: 0.6,
      release: 0.35,
    },
    filter: {
      cutoff: 3500,
      resonance: 0.2,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.5,
      depth: 50,
      waveform: 3, // Sample & Hold (for vinyl warble)
      target: 'filter',
      enabled: true,
    },
    detune: 12,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: false, rate: 4, depth: 0.2 },
      flanger: { enabled: false, depth: 0.2, rate: 0.3, feedback: 0.15, mix: 0.1 },
      delay: { enabled: true, time: 0.3, feedback: 0.2, mix: 0.15 },
      reverb: { enabled: true, size: 0.35, damping: 0.7, mix: 0.25 },
    },
  },

  {
    id: 'jinsang',
    name: 'Jinsang - Smooth Jazz Lo-fi',
    artist: 'Jinsang',
    description: 'Soulful lo-fi with smooth piano loops and laid-back groove',
    genre: 'Lo-fi / Jazz Hip Hop',
    bpm: 80,
    key: 'C',
    globalOctave: 3,
    masterVolume: 0.68,
    waveform: 'piano',
    adsr: {
      attack: 0.015,
      decay: 0.2,
      sustain: 0.75,
      release: 0.4,
    },
    filter: {
      cutoff: 4000,
      resonance: 0.25,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.4,
      depth: 80,
      waveform: 0, // Sine
      target: 'filter',
      enabled: true,
    },
    detune: 5,
    effects: {
      glide: { enabled: true, time: 100 },
      tremolo: { enabled: false, rate: 3, depth: 0.2 },
      flanger: { enabled: false, depth: 0.2, rate: 0.4, feedback: 0.2, mix: 0.15 },
      delay: { enabled: true, time: 0.4, feedback: 0.25, mix: 0.2 },
      reverb: { enabled: true, size: 0.4, damping: 0.65, mix: 0.28 },
    },
  },

  {
    id: 'saib',
    name: 'Saib - Jazz Hop Groove',
    artist: 'Saib',
    description: 'Funky jazz-infused beats with groovy bass and bossa nova vibes',
    genre: 'Jazz Hop / Chillhop',
    bpm: 90,
    key: 'G',
    globalOctave: 3,
    masterVolume: 0.72,
    waveform: 'fm',
    adsr: {
      attack: 0.02,
      decay: 0.18,
      sustain: 0.7,
      release: 0.3,
    },
    filter: {
      cutoff: 5000,
      resonance: 0.35,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.6,
      depth: 100,
      waveform: 1, // Triangle
      target: 'filter',
      enabled: true,
    },
    detune: 3,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: false, rate: 4, depth: 0.25 },
      flanger: { enabled: true, depth: 0.35, rate: 0.8, feedback: 0.25, mix: 0.2 },
      delay: { enabled: true, time: 0.375, feedback: 0.2, mix: 0.18 },
      reverb: { enabled: true, size: 0.38, damping: 0.68, mix: 0.28 },
    },
  },

  {
    id: 'deadcrow',
    name: 'Deadcrow - Dark Phonk',
    artist: 'Deadcrow',
    description: 'Dark, aggressive wave with heavy distorted bass and atmospheric pads',
    genre: 'Wave / Phonk',
    bpm: 135,
    key: 'E',
    globalOctave: 2,
    masterVolume: 0.88,
    waveform: 'sawtooth',
    adsr: {
      attack: 0.01,
      decay: 0.12,
      sustain: 0.65,
      release: 0.35,
    },
    filter: {
      cutoff: 1800,
      resonance: 0.75,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 6.0,
      depth: 500,
      waveform: 2, // Square
      target: 'filter',
      enabled: true,
    },
    detune: -8,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: false, rate: 8, depth: 0.35 },
      flanger: { enabled: true, depth: 0.5, rate: 1.5, feedback: 0.4, mix: 0.3 },
      delay: { enabled: true, time: 0.45, feedback: 0.4, mix: 0.3 },
      reverb: { enabled: true, size: 0.58, damping: 0.6, mix: 0.32 },
    },
  },

  {
    id: 'idealism',
    name: 'Idealism - Peaceful Ambient',
    artist: 'Idealism',
    description: 'Soothing lo-fi with soft piano melodies and minimalistic textures',
    genre: 'Ambient Lo-fi',
    bpm: 70,
    key: 'A',
    globalOctave: 3,
    masterVolume: 0.62,
    waveform: 'sine',
    adsr: {
      attack: 0.25,
      decay: 0.3,
      sustain: 0.85,
      release: 0.8,
    },
    filter: {
      cutoff: 2500,
      resonance: 0.2,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.25,
      depth: 120,
      waveform: 0, // Sine
      target: 'filter',
      enabled: true,
    },
    detune: 10,
    effects: {
      glide: { enabled: true, time: 300 },
      tremolo: { enabled: false, rate: 2, depth: 0.2 },
      flanger: { enabled: false, depth: 0.2, rate: 0.4, feedback: 0.15, mix: 0.1 },
      delay: { enabled: true, time: 0.6, feedback: 0.35, mix: 0.28 },
      reverb: { enabled: true, size: 0.55, damping: 0.55, mix: 0.3 },
    },
  },

  {
    id: 'sleepyfish',
    name: 'Sleepy Fish - Aquatic Dreams',
    artist: 'Sleepy Fish',
    description: 'Dreamy, aquatic lo-fi with gentle guitar plucks and lush pads',
    genre: 'Chillhop / Ambient',
    bpm: 72,
    key: 'D',
    globalOctave: 3,
    masterVolume: 0.66,
    waveform: 'triangle',
    adsr: {
      attack: 0.15,
      decay: 0.25,
      sustain: 0.78,
      release: 0.6,
    },
    filter: {
      cutoff: 3200,
      resonance: 0.28,
      mode: 0, // Lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.35,
      depth: 180,
      waveform: 0, // Sine (for gentle modulation)
      target: 'filter',
      enabled: true,
    },
    detune: 15,
    effects: {
      glide: { enabled: true, time: 200 },
      tremolo: { enabled: false, rate: 3, depth: 0.2 },
      flanger: { enabled: true, depth: 0.4, rate: 0.6, feedback: 0.25, mix: 0.25 },
      delay: { enabled: true, time: 0.5, feedback: 0.3, mix: 0.25 },
      reverb: { enabled: true, size: 0.48, damping: 0.58, mix: 0.3 },
    },
  },

  {
    id: 'inlovewithaghost',
    name: 'In Love With A Ghost - Whimsical Chiptune',
    artist: 'In Love With A Ghost',
    description: 'Playful, nostalgic electronic music with quirky melodies and chiptune textures',
    genre: 'Chillwave / Electronic',
    bpm: 95,
    key: 'A',
    globalOctave: 3, // Reduced from 4 to 3 for better pitch range
    masterVolume: 0.75,
    waveform: 'square',
    adsr: {
      attack: 0.008,
      decay: 0.1,
      sustain: 0.6,
      release: 0.2,
    },
    filter: {
      cutoff: 4500, // Reduced from 6000 to be less harsh
      resonance: 0.35,
      mode: 0, // Changed to Lowpass for warmer chiptune sound
      enabled: true,
    },
    lfo: {
      rate: 2.5,
      depth: 200, // Reduced from 250 for less extreme modulation
      waveform: 3, // Sample & Hold (for glitchy effects)
      target: 'filter',
      enabled: true,
    },
    detune: 12, // Reduced from 20 cents for less dissonance
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: true, rate: 6, depth: 0.3 },
      flanger: { enabled: false, depth: 0.3, rate: 1.0, feedback: 0.2, mix: 0.15 },
      delay: { enabled: true, time: 0.25, feedback: 0.35, mix: 0.3 },
      reverb: { enabled: true, size: 0.42, damping: 0.72, mix: 0.28 },
    },
  },
];

export const defaultPreset: ArtistPreset = {
  id: 'default',
  name: 'Default - Clean Synth',
  artist: 'Default',
  description: 'Clean, balanced synthesizer with moderate settings',
  genre: 'Default',
  bpm: 120,
  key: 'C',
  globalOctave: 3,
  masterVolume: 0.7,
  waveform: 'sine',
  adsr: {
    attack: 0.01,
    decay: 0.2,
    sustain: 1.0,
    release: 0.3,
  },
  filter: {
    cutoff: 20000,
    resonance: 0.707,
    mode: 0,
    enabled: false,
  },
  lfo: {
    rate: 1.0,
    depth: 0.0,
    waveform: 0,
    target: 'filter',
    enabled: false,
  },
  detune: 0,
  effects: {
    glide: { enabled: false, time: 0 },
    tremolo: { enabled: false, rate: 5, depth: 0.5 },
    flanger: { enabled: false, depth: 0.5, rate: 1.5, feedback: 0.3, mix: 0.3 },
    delay: { enabled: false, time: 0.5, feedback: 0.3, mix: 0.3 },
    reverb: { enabled: false, size: 0.5, damping: 0.5, mix: 0.3 },
  },
};

export function getAllPresets(): ArtistPreset[] {
  return [defaultPreset, ...artistPresets];
}

export function getPresetById(id: string): ArtistPreset | undefined {
  return getAllPresets().find((preset) => preset.id === id);
}

