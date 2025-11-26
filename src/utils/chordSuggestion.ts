/**
 * Chord Suggestion Engine
 * Uses 2nd-order Markov Chains + Music Theory Rules
 * Based on research: Nashville Number System progressions, Circle of Fifths, Common Patterns
 */

export interface ChordSuggestion {
  degree: number; // 0-6 (I, ii, iii, IV, V, vi, vii°)
  probability: number; // 0-1
  reason: string; // Why this chord is suggested
  category: 'strong' | 'moderate' | 'adventurous';
}

export interface ChordHistory {
  degree: number;
  timestamp: number;
}

/**
 * Common chord progressions in popular music (Nashville Number System)
 * Based on analysis of thousands of songs
 */
const COMMON_PROGRESSIONS: Record<string, Record<number, number>> = {
  // From I (1)
  '0': { 3: 0.35, 4: 0.25, 5: 0.20, 1: 0.10, 0: 0.05, 2: 0.03, 6: 0.02 },
  // From ii (2)
  '1': { 4: 0.40, 0: 0.25, 3: 0.15, 5: 0.10, 1: 0.05, 2: 0.03, 6: 0.02 },
  // From iii (3)
  '2': { 5: 0.35, 3: 0.25, 0: 0.20, 4: 0.10, 1: 0.05, 2: 0.03, 6: 0.02 },
  // From IV (4)
  '3': { 0: 0.30, 4: 0.25, 1: 0.20, 5: 0.15, 3: 0.05, 2: 0.03, 6: 0.02 },
  // From V (5)
  '4': { 0: 0.50, 5: 0.20, 3: 0.15, 1: 0.08, 4: 0.04, 2: 0.02, 6: 0.01 },
  // From vi (6)
  '5': { 3: 0.30, 1: 0.25, 4: 0.20, 0: 0.15, 5: 0.05, 2: 0.03, 6: 0.02 },
  // From vii° (7)
  '6': { 0: 0.60, 5: 0.20, 2: 0.10, 3: 0.05, 4: 0.03, 1: 0.01, 6: 0.01 },
};

/**
 * 2nd-order Markov Chain: considers last 2 chords
 * Patterns like I-V-vi-IV, I-IV-V, ii-V-I
 */
const SECOND_ORDER_PATTERNS: Record<string, Record<number, number>> = {
  // I-V -> vi (most common: I-V-vi-IV)
  '0-4': { 5: 0.50, 3: 0.25, 0: 0.15, 1: 0.05, 4: 0.03, 2: 0.01, 6: 0.01 },
  // V-vi -> IV
  '4-5': { 3: 0.55, 0: 0.20, 4: 0.15, 1: 0.05, 5: 0.03, 2: 0.01, 6: 0.01 },
  // vi-IV -> I or V
  '5-3': { 0: 0.40, 4: 0.35, 1: 0.10, 5: 0.08, 3: 0.04, 2: 0.02, 6: 0.01 },
  // IV-I -> V
  '3-0': { 4: 0.45, 3: 0.20, 5: 0.15, 1: 0.10, 0: 0.05, 2: 0.03, 6: 0.02 },
  // I-IV -> V
  '0-3': { 4: 0.40, 0: 0.25, 1: 0.15, 5: 0.10, 3: 0.05, 2: 0.03, 6: 0.02 },
  // IV-V -> I
  '3-4': { 0: 0.60, 5: 0.20, 3: 0.10, 1: 0.05, 4: 0.03, 2: 0.01, 6: 0.01 },
  // ii-V -> I (jazz progression)
  '1-4': { 0: 0.55, 5: 0.20, 3: 0.12, 1: 0.06, 4: 0.04, 2: 0.02, 6: 0.01 },
  // vi-ii -> V
  '5-1': { 4: 0.50, 3: 0.25, 0: 0.12, 5: 0.08, 1: 0.03, 2: 0.01, 6: 0.01 },
  // iii-vi -> ii or IV
  '2-5': { 1: 0.40, 3: 0.35, 4: 0.12, 0: 0.08, 5: 0.03, 2: 0.01, 6: 0.01 },
  // I-vi -> IV
  '0-5': { 3: 0.45, 1: 0.25, 4: 0.15, 0: 0.08, 5: 0.04, 2: 0.02, 6: 0.01 },
};

/**
 * Music theory rules: Circle of Fifths relationships
 * Strong: Perfect 5th up (0->4, 1->5, etc.)
 * Moderate: Step-wise motion
 */
function getCircleOfFifthsBonus(from: number, to: number): number {
  // Perfect 5th up (strong voice leading)
  if ((to - from + 7) % 7 === 4) return 0.15;
  // Perfect 4th up (subdominant)
  if ((to - from + 7) % 7 === 3) return 0.12;
  // Step-wise motion (smooth)
  if (Math.abs(to - from) === 1) return 0.08;
  // Return to tonic (I)
  if (to === 0) return 0.10;
  return 0;
}

/**
 * Functional harmony: Tonic, Subdominant, Dominant
 */
const HARMONIC_FUNCTION = {
  tonic: [0, 2, 5], // I, iii, vi
  subdominant: [1, 3], // ii, IV
  dominant: [4, 6], // V, vii°
};

function getFunctionalHarmonyBonus(from: number, to: number): number {
  // Dominant to Tonic (strongest resolution)
  if (HARMONIC_FUNCTION.dominant.includes(from) && HARMONIC_FUNCTION.tonic.includes(to)) {
    return 0.20;
  }
  // Subdominant to Dominant
  if (HARMONIC_FUNCTION.subdominant.includes(from) && HARMONIC_FUNCTION.dominant.includes(to)) {
    return 0.15;
  }
  // Tonic to Subdominant
  if (HARMONIC_FUNCTION.tonic.includes(from) && HARMONIC_FUNCTION.subdominant.includes(to)) {
    return 0.12;
  }
  return 0;
}

/**
 * Add creativity/randomness to suggestions to make them more varied and exciting
 */
function addCreativityBonus(scores: Record<number, { score: number; reasons: string[] }>): void {
  // Add random variation (10-20% boost to random chords)
  Object.keys(scores).forEach(degreeStr => {
    const degree = parseInt(degreeStr);
    const randomBoost = Math.random() * 0.15 + 0.05; // 5-20% random boost
    scores[degree].score += randomBoost;
    
    // Boost "adventurous" chords more to encourage variety
    if ([2, 6].includes(degree)) { // iii and vii° are less common
      scores[degree].score += 0.1;
      scores[degree].reasons.push('Creative choice');
    }
  });
}

/**
 * Main suggestion engine
 */
export function suggestNextChords(
  history: ChordHistory[],
  _bpm: number,
  _currentTime: number
): ChordSuggestion[] {
  if (history.length === 0) {
    // Initial suggestions: varied starting options
    const startOptions = [
      { degree: 0, probability: 0.35, reason: 'Tonic (I) - Classic start', category: 'strong' as const },
      { degree: 4, probability: 0.25, reason: 'Dominant (V) - Bold start', category: 'strong' as const },
      { degree: 3, probability: 0.20, reason: 'Subdominant (IV) - Warm start', category: 'moderate' as const },
      { degree: 5, probability: 0.12, reason: 'vi - Melancholic start', category: 'moderate' as const },
      { degree: 1, probability: 0.08, reason: 'ii - Jazz influence', category: 'adventurous' as const },
    ];
    
    // Shuffle and return top 3
    return startOptions.sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => b.probability - a.probability);
  }

  const lastChord = history[history.length - 1];
  const secondLastChord = history.length > 1 ? history[history.length - 2] : null;
  
  // Calculate probabilities for all possible next chords
  const scores: Record<number, { score: number; reasons: string[] }> = {};
  
  for (let degree = 0; degree < 7; degree++) {
    scores[degree] = { score: 0, reasons: [] };
    
    // 1. First-order Markov Chain (40% weight)
    const markovProb = COMMON_PROGRESSIONS[lastChord.degree.toString()]?.[degree] || 0.01;
    scores[degree].score += markovProb * 0.40;
    if (markovProb > 0.2) {
      scores[degree].reasons.push('Common progression');
    }
    
    // 2. Second-order Markov Chain (30% weight) - if we have 2 chords
    if (secondLastChord) {
      const pattern = `${secondLastChord.degree}-${lastChord.degree}`;
      const secondOrderProb = SECOND_ORDER_PATTERNS[pattern]?.[degree] || 0.01;
      scores[degree].score += secondOrderProb * 0.30;
      if (secondOrderProb > 0.3) {
        scores[degree].reasons.push('Popular pattern');
      }
    }
    
    // 3. Circle of Fifths bonus (15% weight)
    const fifthsBonus = getCircleOfFifthsBonus(lastChord.degree, degree);
    scores[degree].score += fifthsBonus;
    if (fifthsBonus > 0.10) {
      scores[degree].reasons.push('Strong voice leading');
    }
    
    // 4. Functional Harmony bonus (10% weight - reduced)
    const functionBonus = getFunctionalHarmonyBonus(lastChord.degree, degree);
    scores[degree].score += functionBonus * 0.7; // Reduced weight
    if (functionBonus > 0.10) {
      scores[degree].reasons.push('Natural resolution');
    }
  }
  
  // 5. Add creativity/randomness for variety (15% influence)
  addCreativityBonus(scores);
  
  // Normalize scores to probabilities
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
  const suggestions: ChordSuggestion[] = Object.entries(scores)
    .map(([degree, data]) => {
      const prob = data.score / totalScore;
      return {
        degree: parseInt(degree),
        probability: prob,
        reason: data.reasons.join(', ') || 'Possible choice',
        category: (prob > 0.3 ? 'strong' : prob > 0.15 ? 'moderate' : 'adventurous') as 'strong' | 'moderate' | 'adventurous'
      };
    })
    .sort((a, b) => b.probability - a.probability);
  
  // Return top 4 suggestions for more variety
  return suggestions.slice(0, 4);
}

/**
 * Check if user played the suggested chord
 */
export function checkSuggestionMatch(
  playedDegree: number,
  suggestions: ChordSuggestion[]
): { matched: boolean; rank: number; probability: number } | null {
  const matchIndex = suggestions.findIndex(s => s.degree === playedDegree);
  if (matchIndex >= 0) {
    return {
      matched: true,
      rank: matchIndex + 1,
      probability: suggestions[matchIndex].probability,
    };
  }
  return null;
}

/**
 * Analyze user's playing patterns to provide feedback
 */
export function analyzePlayingPattern(history: ChordHistory[]): {
  averageTiming: number;
  consistency: number;
  predictability: number;
} {
  if (history.length < 3) {
    return { averageTiming: 0, consistency: 0, predictability: 0 };
  }
  
  // Calculate average time between chords
  const intervals = [];
  for (let i = 1; i < history.length; i++) {
    intervals.push(history[i].timestamp - history[i - 1].timestamp);
  }
  const averageTiming = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  
  // Calculate consistency (standard deviation)
  const variance = intervals.reduce((sum, interval) => 
    sum + Math.pow(interval - averageTiming, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const consistency = Math.max(0, 1 - (stdDev / averageTiming));
  
  // Calculate predictability (how often they follow common progressions)
  let matches = 0;
  for (let i = 1; i < history.length; i++) {
    const from = history[i - 1].degree;
    const to = history[i].degree;
    const prob = COMMON_PROGRESSIONS[from.toString()]?.[to] || 0;
    if (prob > 0.15) matches++;
  }
  const predictability = matches / (history.length - 1);
  
  return { averageTiming, consistency, predictability };
}

