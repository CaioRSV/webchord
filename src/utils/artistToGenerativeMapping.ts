/**
 * ARTIST PRESET TO GENERATIVE PRESET MAPPING
 * Maps each artist's style to appropriate procedural generation parameters
 */

import { GenerationConfig } from './proceduralMusicGenerator';

export interface ArtistGenerativeMapping {
  generativePreset: string; // Which generative preset to use
  customConfig?: Partial<GenerationConfig>; // Optional overrides for more specific styling
  description: string; // What kind of progression will be generated
}

export const ARTIST_GENERATIVE_MAPPINGS: { [artistName: string]: ArtistGenerativeMapping } = {
  'oneheart': {
    generativePreset: 'Ambient Chill',
    customConfig: {
      density: 0.3,
      tensionCurve: 'wave',
      rhythmicStyle: 'sparse',
      phraseStructure: 'through-composed',
      creativity: 0.6,
    },
    description: 'Melancholic ambient progression with sparse, emotional chords',
  },
  
  'Skeler': {
    generativePreset: 'Energetic EDM',
    customConfig: {
      density: 0.65,
      tensionCurve: 'buildup',
      rhythmicStyle: 'syncopated',
      phraseStructure: 'AABA',
      creativity: 0.4,
    },
    description: 'Dark synthwave progression with energetic buildup',
  },
  
  'Eevee': {
    generativePreset: 'Ambient Chill',
    customConfig: {
      density: 0.4,
      tensionCurve: 'wave',
      rhythmicStyle: 'sparse',
      phraseStructure: 'ABAB',
      creativity: 0.5,
    },
    description: 'Dreamy lofi progression with gentle waves',
  },
  
  'Jinsang': {
    generativePreset: 'Jazz Exploration',
    customConfig: {
      density: 0.5,
      tensionCurve: 'arc',
      rhythmicStyle: 'syncopated',
      phraseStructure: 'question-answer',
      creativity: 0.7,
    },
    description: 'Smooth jazz-influenced lofi with sophisticated harmony',
  },
  
  'Saib': {
    generativePreset: 'Jazz Exploration',
    customConfig: {
      density: 0.55,
      tensionCurve: 'wave',
      rhythmicStyle: 'syncopated',
      phraseStructure: 'ABAC',
      creativity: 0.75,
    },
    description: 'Jazzy chillhop with creative chord choices',
  },
  
  'Deadcrow': {
    generativePreset: 'Energetic EDM',
    customConfig: {
      density: 0.7,
      tensionCurve: 'buildup',
      rhythmicStyle: 'syncopated',
      phraseStructure: 'through-composed',
      creativity: 0.5,
    },
    description: 'Dark wave/phonk progression with aggressive energy',
  },
  
  'Idealism': {
    generativePreset: 'Minimalist',
    customConfig: {
      density: 0.25,
      tensionCurve: 'release',
      rhythmicStyle: 'sparse',
      phraseStructure: 'ABAC',
      creativity: 0.4,
    },
    description: 'Minimalist ambient with spacious arrangement',
  },
  
  'Sleepy Fish': {
    generativePreset: 'Ambient Chill',
    customConfig: {
      density: 0.35,
      tensionCurve: 'wave',
      rhythmicStyle: 'sparse',
      phraseStructure: 'through-composed',
      creativity: 0.5,
    },
    description: 'Dreamy chillhop with ambient textures',
  },
  
  'In Love With A Ghost': {
    generativePreset: 'Pop Hit',
    customConfig: {
      density: 0.6,
      tensionCurve: 'arc',
      rhythmicStyle: 'steady',
      phraseStructure: 'ABAB',
      creativity: 0.3,
    },
    description: 'Upbeat chillwave with catchy chord progressions',
  },
};

/**
 * Get generative configuration for an artist preset
 */
export function getArtistGenerativeConfig(artistName: string): {
  config: GenerationConfig;
  presetName: string;
  description: string;
} | null {
  const mapping = ARTIST_GENERATIVE_MAPPINGS[artistName];
  if (!mapping) return null;
  
  // Start with the base generative preset config
  const baseConfig: GenerationConfig = {
    slots: 16,
    density: 0.5,
    tensionCurve: 'arc',
    rhythmicStyle: 'steady',
    phraseStructure: 'ABAB',
    creativity: 0.5,
  };
  
  // Apply custom overrides if any
  const config: GenerationConfig = {
    ...baseConfig,
    ...mapping.customConfig,
  };
  
  return {
    config,
    presetName: mapping.generativePreset,
    description: mapping.description,
  };
}

