import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { 
  suggestNextChords, 
  checkSuggestionMatch,
  analyzePlayingPattern,
  ChordSuggestion as ChordSuggestionType,
  ChordHistory
} from '../../utils/chordSuggestion';
import { CHORD_NAMES } from '../../music/chords';

interface ChordSuggestionProps {
  onSuggestionHighlight?: (degrees: number[]) => void;
}

export default function ChordSuggestion({ onSuggestionHighlight }: ChordSuggestionProps) {
  const bpm = useAppStore((state) => state.audio.bpm);
  const [suggestions, setSuggestions] = useState<ChordSuggestionType[]>([]);
  const [chordHistory, setChordHistory] = useState<ChordHistory[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [stats, setStats] = useState({ averageTiming: 0, consistency: 0, predictability: 0 });
  
  // Listen to chord events from ChordButtons
  useEffect(() => {
    const handleChordPlayed = (event: CustomEvent) => {
      const { degree, timestamp } = event.detail;
      
      // Add to history
      setChordHistory(prev => {
        const newHistory = [...prev, { degree, timestamp }];
        // Keep last 20 chords for analysis
        if (newHistory.length > 20) newHistory.shift();
        
        // Check if user matched a suggestion
        if (suggestions.length > 0) {
          const match = checkSuggestionMatch(degree, suggestions);
          if (match) {
            const messages = [
              `🎯 Perfect! Top ${match.rank} suggestion (${Math.round(match.probability * 100)}%)`,
              `✨ Great choice! ${match.rank === 1 ? 'Predicted!' : 'Strong move!'}`,
              `🎵 Excellent! ${match.rank === 1 ? 'Exactly as expected' : 'Solid progression'}`,
            ];
            setFeedbackMessage(messages[Math.floor(Math.random() * messages.length)]);
            setShowFeedback(true);
            setTimeout(() => setShowFeedback(false), 2000);
          }
        }
        
        return newHistory;
      });
    };
    
    window.addEventListener('chordPlayed' as any, handleChordPlayed);
    return () => window.removeEventListener('chordPlayed' as any, handleChordPlayed);
  }, [suggestions]);
  
  // Update suggestions when history changes
  useEffect(() => {
    const newSuggestions = suggestNextChords(chordHistory, bpm, Date.now());
    setSuggestions(newSuggestions);
    
    // Notify parent component to highlight suggested buttons
    if (onSuggestionHighlight) {
      onSuggestionHighlight(newSuggestions.map(s => s.degree));
    }
    
    // Update stats
    if (chordHistory.length >= 3) {
      const newStats = analyzePlayingPattern(chordHistory);
      setStats(newStats);
    }
  }, [chordHistory, bpm, onSuggestionHighlight]);
  
  
  const handleClearHistory = () => {
    setChordHistory([]);
    setSuggestions([]);
    setStats({ averageTiming: 0, consistency: 0, predictability: 0 });
  };
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strong': return 'from-green-500 to-emerald-600';
      case 'moderate': return 'from-blue-500 to-cyan-600';
      case 'adventurous': return 'from-purple-500 to-pink-600';
      default: return 'from-gray-500 to-slate-600';
    }
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'strong': return '🎯';
      case 'moderate': return '🎵';
      case 'adventurous': return '✨';
      default: return '🎹';
    }
  };
  
  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-3 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white text-xs font-bold flex items-center gap-2">
          <span className="text-lg">🎯</span> AI SUGGESTIONS
        </h3>
        <button
          onClick={handleClearHistory}
          className="text-xs text-slate-400 hover:text-white transition-colors"
          title="Clear history"
        >
          🔄
        </button>
      </div>
      
      {/* Suggestions - Vertical Stack */}
      <div className="space-y-2 mb-2">
        {suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => {
            return (
              <div
                key={suggestion.degree}
                className={`relative p-3 rounded-lg border transition-all duration-300 cursor-pointer hover:scale-[1.01] ${
                  index === 0 
                    ? 'border-green-400 bg-gradient-to-br from-green-900/30 to-green-800/20 shadow-lg shadow-green-900/20' 
                    : 'border-slate-600 bg-gradient-to-br from-slate-900/50 to-slate-800/30 hover:border-slate-500 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-base">
                      {suggestion.degree + 1}. {CHORD_NAMES[suggestion.degree]}
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                        BEST
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${
                    index === 0 ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {Math.round(suggestion.probability * 100)}%
                  </span>
                </div>
                
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2 shadow-inner">
                  <div
                    className={`h-full bg-gradient-to-r ${getCategoryColor(suggestion.category)} transition-all duration-500 shadow-sm`}
                    style={{ width: `${suggestion.probability * 100}%` }}
                  />
                </div>
                
                {/* Highlighted Description */}
                <div className={`flex items-center gap-2 p-2 rounded-md ${
                  index === 0 
                    ? 'bg-green-900/30 border border-green-700/30' 
                    : 'bg-slate-800/50 border border-slate-700/30'
                }`}>
                  <span className="text-base flex-shrink-0">{getCategoryIcon(suggestion.category)}</span>
                  <p className={`text-xs font-semibold ${
                    index === 0 ? 'text-green-300' : 'text-slate-300'
                  }`}>
                    {suggestion.reason}
                  </p>
                </div>
                
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
            <div className="text-3xl mb-2">🎹</div>
            <p className="font-semibold">Play to see suggestions</p>
            <p className="text-slate-500 mt-1">AI will predict your next chord</p>
          </div>
        )}
      </div>
      
      {/* Feedback Message */}
      {showFeedback && (
        <div className="mb-2 p-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg animate-pulse">
          <p className="text-white text-xs font-bold text-center">
            {feedbackMessage}
          </p>
        </div>
      )}
      
      {/* Compact Stats */}
      {chordHistory.length >= 3 && (
        <div className="bg-slate-900/50 rounded-lg p-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Pattern Match</span>
            <span className="font-bold text-green-400">
              {Math.round(stats.predictability * 100)}%
            </span>
          </div>
        </div>
      )}
      
    </div>
  );
}

