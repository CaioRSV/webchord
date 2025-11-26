export type Key = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type ChordType = 
  | 'major' 
  | 'minor' 
  | 'dom7' 
  | 'maj7' 
  | 'min7' 
  | 'sus2' 
  | 'sus4' 
  | 'aug' 
  | 'dim' 
  | 'maj9' 
  | 'min9' 
  | 'maj6';

export type ChordModType = 
  | 'maj/min' 
  | '7th' 
  | 'maj7/min7' 
  | 'maj9/min9' 
  | 'sus4' 
  | 'sus2/add6' 
  | 'dim' 
  | 'aug';

export const NOTES: Key[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Major scale intervals (semitones from root)
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// Chord quality intervals (semitones from scale degree root)
const CHORD_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  maj6: [0, 4, 7, 9],
};

// Nashville Number System chord qualities for each scale degree
const NASHVILLE_CHORDS: Record<number, string> = {
  1: 'major',   // I
  2: 'minor',  // ii
  3: 'minor',  // iii
  4: 'major',  // IV
  5: 'major',  // V
  6: 'minor',  // vi
  7: 'dim',    // vii°
};

export function getNoteIndex(note: Key): number {
  return NOTES.indexOf(note);
}

export function getNoteFromIndex(index: number): Key {
  return NOTES[((index % 12) + 12) % 12];
}

export function generateChord(
  key: Key,
  scaleDegree: number, // 1-7 (Nashville Number System)
  chordType?: ChordType,
  inversion: number = 0,
  octave: number = 3
): number[] {
  if (scaleDegree < 1 || scaleDegree > 7) {
    throw new Error('Scale degree must be between 1 and 7');
  }

  const keyIndex = getNoteIndex(key);
  const scaleRootSemitones = MAJOR_SCALE[scaleDegree - 1];
  const chordRootSemitones = (keyIndex + scaleRootSemitones) % 12;

  const baseChordType = chordType || NASHVILLE_CHORDS[scaleDegree];
  const intervals = CHORD_INTERVALS[baseChordType] || CHORD_INTERVALS.major;

  // Generate MIDI notes
  // MIDI note calculation: C4 = 60, so MIDI = (octave + 1) * 12 + noteIndex
  const midiNotes: number[] = intervals.map(interval => {
    const semitones = chordRootSemitones + interval;
    const noteIndex = semitones % 12;
    const octaveOffset = Math.floor(semitones / 12);
    // MIDI note: (octave + 1) * 12 gives us the base for that octave
    // C4 = 60, so octave 3 = C3 = 48, octave 4 = C4 = 60
    return (octave + 1) * 12 + noteIndex + (octaveOffset * 12);
  });

  // Apply inversion
  if (inversion > 0 && inversion < midiNotes.length) {
    const inverted = [...midiNotes];
    for (let i = 0; i < inversion; i++) {
      const note = inverted.shift()!;
      inverted.push(note + 12); // Move to next octave
    }
    return inverted;
  }

  return midiNotes;
}

export function getChordName(
  key: Key,
  scaleDegree: number,
  chordType?: ChordType
): string {
  const keyIndex = getNoteIndex(key);
  const scaleRootSemitones = MAJOR_SCALE[scaleDegree - 1];
  const chordRootSemitones = (keyIndex + scaleRootSemitones) % 12;
  const rootNote = getNoteFromIndex(chordRootSemitones);
  
  const baseChordType = chordType || NASHVILLE_CHORDS[scaleDegree];
  const typeNames: Record<string, string> = {
    major: 'Major',
    minor: 'Minor',
    dom7: '7',
    maj7: 'Maj7',
    min7: 'Min7',
    sus2: 'Sus2',
    sus4: 'Sus4',
    aug: 'Aug',
    dim: 'Dim',
    maj9: 'Maj9',
    min9: 'Min9',
    maj6: 'Maj6',
  };

  return `${rootNote} ${typeNames[baseChordType] || ''}`;
}

export function applyChordModification(
  baseType: ChordType,
  modification: ChordModType
): ChordType {
  const modMap: Record<ChordModType, Record<string, ChordType>> = {
    'maj/min': {
      major: 'minor',
      minor: 'major',
    },
    '7th': {
      major: 'dom7',
      minor: 'min7',
    },
    'maj7/min7': {
      major: 'maj7',
      minor: 'min7',
      dom7: 'maj7',
      min7: 'min7',
    },
    'maj9/min9': {
      major: 'maj9',
      minor: 'min9',
      maj7: 'maj9',
      min7: 'min9',
    },
    'sus4': {
      major: 'sus4',
      minor: 'sus4',
    },
    'sus2/add6': {
      major: 'sus2',
      minor: 'maj6',
    },
    'dim': {
      major: 'dim',
      minor: 'dim',
    },
    'aug': {
      major: 'aug',
      minor: 'aug',
    },
  };

  return modMap[modification]?.[baseType] || baseType;
}

