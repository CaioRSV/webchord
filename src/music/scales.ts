import { Key, NOTES } from './chords';

export type Mode = 'major' | 'minor';

export function getScaleIntervals(mode: Mode): number[] {
  if (mode === 'major') {
    return [0, 2, 4, 5, 7, 9, 11];
  } else {
    // Natural minor
    return [0, 2, 3, 5, 7, 8, 10];
  }
}

export function getScaleNotes(key: Key, mode: Mode): Key[] {
  const intervals = getScaleIntervals(mode);
  const keyIndex = NOTES.indexOf(key);
  return intervals.map(interval => {
    const noteIndex = (keyIndex + interval) % 12;
    return NOTES[noteIndex];
  });
}

