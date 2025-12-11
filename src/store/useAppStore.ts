import { create } from 'zustand';
import { Key, ChordModType } from '../music/chords';
import { Mode } from '../music/scales';

export type WaveformType = 'sine' | 'sawtooth' | 'square' | 'triangle' | 'fm' | 'piano';
export type PlaybackMode = 'play' | 'arpeggiator' | 'drum' | 'autodrum';
export type ArpDirection = 'up' | 'down' | 'updown' | 'downup' | 'random' | 'asplayed';
export type Subdivision = '1/4' | '1/8' | '1/16' | '1/16T' | '1/32';

export interface ADSR {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  preset?: 'LONG' | 'SHORT' | 'SWELL' | 'PLUCK' | 'TOUCH' | 'SUSTAIN';
}


export interface LFO {
  rate: number;
  depth: number;
  waveform: number; // 0=sine, 1=triangle, 2=square, 3=sample&hold
  target: 'pitch' | 'filter' | 'amplitude' | 'pan';
  enabled: boolean;
}

export interface Effects {
  glide: { enabled: boolean; time: number };
  tremolo: { enabled: boolean; rate: number; depth: number };
  flanger: { enabled: boolean; rate: number; depth: number; feedback: number; mix: number };
  delay: { enabled: boolean; time: number; feedback: number; mix: number };
  reverb: { enabled: boolean; size: number; damping: number; mix: number };
  bass: { enabled: boolean; level: number };
  stereo: { mode: 'mono' | 'stereo' | 'wide' };
}

export interface ChordButtonState {
  inversion: number;
  octaveOffset: number;
}

export interface RecordedNote {
  time: number;
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  velocity: number;
  degree: number;
}

export interface Pattern {
  id: string;
  name: string;
  notes: RecordedNote[];
  length: number; // in seconds
  color: string;
  // Captured parameters at the time of recording
  capturedParameters?: {
    waveform: WaveformType;
  adsr: ADSR;
  lfo: LFO;
  detune: number;
  effects: Effects;
  };
}

export interface TimelineClip {
  id: string;
  patternId: string;
  startTime: number; // in beats
  track: number;
}

export interface Sequencer {
  arpPattern: boolean[];
  arpDirection: ArpDirection;
  subdivision: Subdivision;
  swing: number;
  isPlaying: boolean;
  currentStep: number;
  steps: Array<{
    active: boolean;
    degree: number;
    velocity: number;
  }>;
  // Recording system
  isRecording: boolean;
  recordingStartTime: number;
  recordedNotes: RecordedNote[];
  patterns: Pattern[];
  timeline: TimelineClip[];
  playbackPosition: number; // in beats
}

export interface Looper {
  state: 'empty' | 'recording' | 'playing' | 'overdubbing';
  recording: boolean;
  playing: boolean;
  overdub: boolean;
  recordedEvents: any[];
  recordedNotes: Array<{
    time: number;
    type: 'noteOn' | 'noteOff';
    midiNote: number;
    velocity: number;
  }>;
  loopLength: number; // bars
}

export type UiMode = 'simple' | 'advanced';
export type UiControlFocus = 'pad' | 'synth' | 'effects' | 'timeline';

export interface UiState {
  mode: UiMode;
  controlFocus: UiControlFocus;
}

export interface AppState {
  // Audio
  audio: {
    isPlaying: boolean;
    masterVolume: number;
    bpm: number;
    currentMode: PlaybackMode;
    releaseMode: 'fixed' | 'immediate'; // Fixed ADSR release or immediate on button up
  };
  
  // Synthesis
  synthesis: {
    waveform: WaveformType;
    voiceCount: number;
    detune: number; // cents
    adsr: ADSR;
    lfo: LFO;
  };
  
  // Effects
  effects: Effects;

  // Playback
  playback: {
    arpeggiator: {
      pattern: 'up' | 'down' | 'updown' | 'random';
      speed: number;
      octaves: number;
      gate: number;
    };
  };
  
  // Music
  music: {
    key: Key;
    mode: Mode;
    globalOctave: number;
    chordButtons: ChordButtonState[];
    currentChordModification: ChordModType | null;
  };
  
  // Sequencer
  sequencer: Sequencer;
  
  // Looper
  looper: Looper;

  // UI / Interaction mode
  ui: UiState;
}

// Keyboard-style ADSR - notes sustain at full volume when held
const defaultADSR: ADSR = {
  attack: 0.01,   // Very fast attack (10ms) - instant response
  decay: 0.2,     // Short decay (200ms) - quick initial brightness
  sustain: 1.0,   // Full sustain - notes hold at 100% volume when key is held
  release: 0.3,   // Medium release (300ms) - natural fade out when released
};

const defaultEffects: Effects = {
  glide: { enabled: false, time: 0 },
  tremolo: { enabled: false, rate: 5, depth: 0.5 },
  flanger: { enabled: false, rate: 0.5, depth: 5, feedback: 0.5, mix: 0.5 },
  delay: { enabled: false, time: 0.5, feedback: 0.3, mix: 0.3 },
  reverb: { enabled: false, size: 0.5, damping: 0.5, mix: 0.5 },
  bass: { enabled: false, level: 0.5 },
  stereo: { mode: 'stereo' },
};

export const useAppStore = create<AppState>(() => ({
  audio: {
    isPlaying: false,
    masterVolume: 0.7,
    bpm: 120,
    currentMode: 'play',
    releaseMode: 'fixed',
  },
  
  synthesis: {
    waveform: 'sine',
    voiceCount: 4,
    detune: 0,
    adsr: defaultADSR,
    lfo: {
      rate: 1.0,
      depth: 0.0,
      waveform: 0,
      target: 'amplitude',
      enabled: false,
    },
  },
  
  effects: defaultEffects,

  playback: {
    arpeggiator: {
      pattern: 'up',
      speed: 1,
      octaves: 1,
      gate: 0.8,
    },
  },
  
  music: {
    key: 'C',
    mode: 'major',
    globalOctave: 3,
    chordButtons: Array(7).fill(null).map(() => ({
      inversion: 0,
      octaveOffset: 0,
    })),
    currentChordModification: null,
  },
  
  sequencer: {
    arpPattern: Array(16).fill(false),
    arpDirection: 'up',
    subdivision: '1/16',
    swing: 0,
    isPlaying: false,
    currentStep: 0,
    steps: Array(16)
      .fill(null)
      .map(() => ({ active: false, degree: 1, velocity: 1.0 })),
    isRecording: false,
    recordingStartTime: 0,
    recordedNotes: [],
    patterns: [],
    timeline: [],
    playbackPosition: 0,
  },
  
  looper: {
    state: 'empty',
    recording: false,
    playing: false,
    overdub: false,
    recordedEvents: [],
    recordedNotes: [],
    loopLength: 0,
  },

  ui: {
    mode: 'simple',
    controlFocus: 'pad',
  },
}));

