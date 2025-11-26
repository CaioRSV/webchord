/**
 * SYNTHESIS PARAMETERS FOR GENERATIVE PRESETS
 * Each procedural music preset has corresponding synthesis settings
 * to create a cohesive sonic experience
 */

import { WaveformType, ADSR, Filter, LFO, Effects } from '../store/useAppStore';

export interface GenerativePresetParameters {
  waveform: WaveformType;
  adsr: ADSR;
  filter: Filter;
  lfo: LFO;
  detune: number;
  effects: Effects;
}

export const GENERATIVE_PRESET_PARAMETERS: { [key: string]: GenerativePresetParameters } = {
  'Pop Hit': {
    waveform: 'sawtooth',
    adsr: {
      attack: 0.01,
      decay: 0.3,
      sustain: 0.7,
      release: 0.5,
    },
    filter: {
      cutoff: 3000,
      resonance: 1.2,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 4.0,
      depth: 0.2,
      waveform: 0, // sine
      target: 'filter',
      enabled: true,
    },
    detune: 5,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: false, rate: 5, depth: 0.5 },
      flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
      delay: { enabled: true, time: 0.375, feedback: 0.3, mix: 0.2 },
      reverb: { enabled: true, size: 0.4, damping: 0.6, mix: 0.25 },
      bass: { enabled: false, level: 0.5 },
      stereo: { mode: 'stereo' },
    },
  },
  
  'Ambient Chill': {
    waveform: 'sine',
    adsr: {
      attack: 1.2,
      decay: 0.8,
      sustain: 0.6,
      release: 2.5,
    },
    filter: {
      cutoff: 1200,
      resonance: 0.8,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.3,
      depth: 0.4,
      waveform: 0, // sine
      target: 'filter',
      enabled: true,
    },
    detune: 12,
    effects: {
      glide: { enabled: true, time: 400 },
      tremolo: { enabled: true, rate: 0.5, depth: 0.3 },
      flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
      delay: { enabled: true, time: 0.75, feedback: 0.5, mix: 0.4 },
      reverb: { enabled: true, size: 0.85, damping: 0.3, mix: 0.6 },
      bass: { enabled: false, level: 0.5 },
      stereo: { mode: 'wide' },
    },
  },
  
  'Energetic EDM': {
    waveform: 'square',
    adsr: {
      attack: 0.005,
      decay: 0.15,
      sustain: 0.8,
      release: 0.2,
    },
    filter: {
      cutoff: 5000,
      resonance: 2.5,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 8.0,
      depth: 0.6,
      waveform: 2, // square
      target: 'filter',
      enabled: true,
    },
    detune: 8,
    effects: {
      glide: { enabled: false, time: 0 },
      tremolo: { enabled: false, rate: 5, depth: 0.5 },
      flanger: { enabled: true, rate: 1.5, depth: 8, feedback: 0.6, mix: 0.4 },
      delay: { enabled: true, time: 0.25, feedback: 0.4, mix: 0.3 },
      reverb: { enabled: true, size: 0.3, damping: 0.7, mix: 0.2 },
      bass: { enabled: true, level: 0.7 },
      stereo: { mode: 'wide' },
    },
  },
  
  'Jazz Exploration': {
    waveform: 'fm',
    adsr: {
      attack: 0.02,
      decay: 0.4,
      sustain: 0.6,
      release: 0.8,
    },
    filter: {
      cutoff: 2500,
      resonance: 1.0,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 2.5,
      depth: 0.3,
      waveform: 3, // sample & hold
      target: 'filter',
      enabled: true,
    },
    detune: 15,
    effects: {
      glide: { enabled: true, time: 100 },
      tremolo: { enabled: true, rate: 4, depth: 0.4 },
      flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
      delay: { enabled: true, time: 0.5, feedback: 0.35, mix: 0.35 },
      reverb: { enabled: true, size: 0.6, damping: 0.5, mix: 0.4 },
      bass: { enabled: false, level: 0.5 },
      stereo: { mode: 'stereo' },
    },
  },
  
  'Minimalist': {
    waveform: 'triangle',
    adsr: {
      attack: 0.5,
      decay: 0.3,
      sustain: 0.5,
      release: 1.5,
    },
    filter: {
      cutoff: 1800,
      resonance: 0.707,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 0.5,
      depth: 0.15,
      waveform: 1, // triangle
      target: 'filter',
      enabled: true,
    },
    detune: 3,
    effects: {
      glide: { enabled: true, time: 200 },
      tremolo: { enabled: false, rate: 5, depth: 0.5 },
      flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
      delay: { enabled: true, time: 0.667, feedback: 0.25, mix: 0.2 },
      reverb: { enabled: true, size: 0.7, damping: 0.4, mix: 0.5 },
      bass: { enabled: false, level: 0.5 },
      stereo: { mode: 'stereo' },
    },
  },
  
  'Epic Buildup': {
    waveform: 'sawtooth',
    adsr: {
      attack: 0.1,
      decay: 0.5,
      sustain: 0.8,
      release: 1.0,
    },
    filter: {
      cutoff: 4000,
      resonance: 1.8,
      mode: 0, // lowpass
      enabled: true,
    },
    lfo: {
      rate: 1.5,
      depth: 0.5,
      waveform: 0, // sine
      target: 'filter',
      enabled: true,
    },
    detune: 10,
    effects: {
      glide: { enabled: true, time: 300 },
      tremolo: { enabled: false, rate: 5, depth: 0.5 },
      flanger: { enabled: true, rate: 0.8, depth: 6, feedback: 0.5, mix: 0.3 },
      delay: { enabled: true, time: 0.5, feedback: 0.45, mix: 0.35 },
      reverb: { enabled: true, size: 0.75, damping: 0.5, mix: 0.5 },
      bass: { enabled: true, level: 0.6 },
      stereo: { mode: 'wide' },
    },
  },
  
  'Completely Random': {
    waveform: 'piano',
    adsr: {
      attack: 0.01 + Math.random() * 1.0,
      decay: 0.1 + Math.random() * 1.0,
      sustain: 0.3 + Math.random() * 0.7,
      release: 0.2 + Math.random() * 2.0,
    },
    filter: {
      cutoff: 500 + Math.random() * 8000,
      resonance: 0.5 + Math.random() * 2.0,
      mode: Math.floor(Math.random() * 3), // random filter mode
      enabled: Math.random() > 0.3,
    },
    lfo: {
      rate: 0.1 + Math.random() * 10,
      depth: Math.random() * 0.8,
      waveform: Math.floor(Math.random() * 4),
      target: 'filter',
      enabled: Math.random() > 0.4,
    },
    detune: Math.random() * 25,
    effects: {
      glide: { enabled: Math.random() > 0.7, time: Math.random() * 500 },
      tremolo: { enabled: Math.random() > 0.6, rate: 1 + Math.random() * 8, depth: 0.2 + Math.random() * 0.6 },
      flanger: { enabled: Math.random() > 0.7, rate: 0.2 + Math.random() * 2, depth: 2 + Math.random() * 8, feedback: 0.3 + Math.random() * 0.5, mix: 0.2 + Math.random() * 0.5 },
      delay: { enabled: Math.random() > 0.4, time: 0.2 + Math.random() * 0.8, feedback: 0.2 + Math.random() * 0.5, mix: 0.1 + Math.random() * 0.4 },
      reverb: { enabled: Math.random() > 0.3, size: 0.3 + Math.random() * 0.6, damping: 0.3 + Math.random() * 0.6, mix: 0.2 + Math.random() * 0.6 },
      bass: { enabled: Math.random() > 0.6, level: 0.4 + Math.random() * 0.4 },
      stereo: { mode: Math.random() > 0.5 ? 'wide' : 'stereo' },
    },
  },
};

// Default parameters for 'Random' preset (balanced, neutral sound)
export const DEFAULT_GENERATIVE_PARAMETERS: GenerativePresetParameters = {
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
    target: 'amplitude',
    enabled: false,
  },
  detune: 0,
  effects: {
    glide: { enabled: false, time: 0 },
    tremolo: { enabled: false, rate: 5, depth: 0.5 },
    flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
    delay: { enabled: false, time: 0.5, feedback: 0.3, mix: 0.3 },
    reverb: { enabled: false, size: 0.5, damping: 0.5, mix: 0.5 },
    bass: { enabled: false, level: 0.5 },
    stereo: { mode: 'stereo' },
  },
};

/**
 * Get synthesis parameters for a given preset name
 */
export function getGenerativePresetParameters(presetName?: string): GenerativePresetParameters {
  if (!presetName || presetName === 'Random') {
    return DEFAULT_GENERATIVE_PARAMETERS;
  }
  
  return GENERATIVE_PRESET_PARAMETERS[presetName] || DEFAULT_GENERATIVE_PARAMETERS;
}

