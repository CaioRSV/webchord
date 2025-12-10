import { AppState, Pattern } from '../store/useAppStore';

export function exportArrangementAsJSON(state: AppState): string {
  const { audio, music, sequencer } = state;

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      bpm: audio.bpm,
      key: music.key,
      mode: music.mode,
    },
    patterns: sequencer.patterns,
    timeline: sequencer.timeline,
  };

  return JSON.stringify(payload, null, 2);
}

export function importArrangementFromJSON(json: string): {
  meta?: { bpm?: number; key?: string; mode?: string };
  patterns: AppState['sequencer']['patterns'];
  timeline: AppState['sequencer']['timeline'];
} | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed) {
      return null;
    }

    // Full arrangement export: { meta, patterns: [...], timeline: [...] }
    if (Array.isArray(parsed.patterns) && Array.isArray(parsed.timeline)) {
      return {
        meta: parsed.meta || {},
        patterns: parsed.patterns,
        timeline: parsed.timeline,
      };
    }

    // Single pattern export: { id, name, notes, length, color, ... }
    // Wrap as one-element patterns array and empty timeline
    if (Array.isArray(parsed.notes)) {
      return {
        meta: parsed.meta || {},
        patterns: [parsed as Pattern],
        timeline: [],
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function exportPatternAsJSON(pattern: Pattern): string {
  return JSON.stringify(pattern, null, 2);
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
