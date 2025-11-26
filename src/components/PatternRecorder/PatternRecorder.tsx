import { useState, useEffect, useRef } from 'react';
import { useAppStore, Pattern } from '../../store/useAppStore';

interface PatternRecorderProps {
  onPatternCreated?: (pattern: Pattern) => void;
}

export default function PatternRecorder({ onPatternCreated }: PatternRecorderProps) {
  const isRecording = useAppStore((state) => state.sequencer.isRecording);
  const recordedNotes = useAppStore((state) => state.sequencer.recordedNotes);
  const recordingStartTime = useAppStore((state) => state.sequencer.recordingStartTime);
  const [recordingTime, setRecordingTime] = useState(0);
  const [patternName, setPatternName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording && recordingStartTime > 0) {
      // Timer for recording (recording already started by first note)
      timerRef.current = setInterval(() => {
        setRecordingTime((performance.now() - recordingStartTime) / 1000);
      }, 100);
    } else {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!isRecording) {
        setRecordingTime(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, recordingStartTime]);

  const enableRecording = () => {
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        isRecording: true,
        recordingStartTime: 0, // Will be set by first note
        recordedNotes: [],
      },
    }));
  };

  const stopRecording = () => {
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        isRecording: false,
        recordingStartTime: 0,
      },
    }));
  };

  const savePattern = () => {
    if (recordedNotes.length === 0) {
      alert('No notes recorded!');
      return;
    }

    // Calculate actual pattern length from last note timestamp
    const lastNoteTime = Math.max(...recordedNotes.map(n => n.time));
    const patternLength = (lastNoteTime / 1000) + 0.5; // Add 0.5s padding

    console.log('Saving pattern:', {
      noteCount: recordedNotes.length,
      lastNoteTime,
      patternLength,
      notes: recordedNotes,
    });

    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    
    // Capture current parameters at the time of recording
    const currentState = useAppStore.getState();
    
    const pattern: Pattern = {
      id: Date.now().toString(),
      name: patternName || `Pattern ${Date.now()}`,
      notes: recordedNotes,
      length: patternLength,
      color: colors[Math.floor(Math.random() * colors.length)],
      capturedParameters: {
        waveform: currentState.synthesis.waveform,
        adsr: { ...currentState.synthesis.adsr },
        filter: { ...currentState.synthesis.filter },
        lfo: { ...currentState.synthesis.lfo },
        detune: currentState.synthesis.detune,
        effects: JSON.parse(JSON.stringify(currentState.effects)), // Deep clone
      },
    };

    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        patterns: [...state.sequencer.patterns, pattern],
        recordedNotes: [],
      },
    }));

    setPatternName('');
    if (onPatternCreated) {
      onPatternCreated(pattern);
    }

    console.log('Pattern saved:', pattern);
    alert(`Pattern "${pattern.name}" saved! (${patternLength.toFixed(1)}s)`);
  };

  const discardRecording = () => {
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        recordedNotes: [],
      },
    }));
    setPatternName('');
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-md rounded-lg p-3 border-2 border-slate-700">
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          isRecording ? 'bg-red-900/50 border-2 border-red-500' : 'bg-slate-900/50 border-2 border-slate-600'
        }`}>
          <span className={`text-lg ${isRecording ? 'animate-pulse' : ''}`}>
            {isRecording ? '🔴' : '⏸'}
          </span>
          <div className="flex flex-col">
            <span className="text-white text-xs font-bold">
              {isRecording ? 'RECORDING' : 'READY'}
            </span>
            <span className="text-slate-300 text-xs font-mono">
              {recordingTime.toFixed(1)}s · {recordedNotes.length} notes
            </span>
          </div>
        </div>

        {/* Main Recording Button */}
        {!isRecording ? (
          <button
            onClick={enableRecording}
            className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-bold transition-all shadow-lg text-sm"
          >
            🔴 ARM RECORDING
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-2 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-black text-white rounded-lg font-bold transition-all shadow-lg text-sm animate-pulse"
          >
            ⏹ STOP
          </button>
        )}

        {/* Save/Discard Controls */}
        {!isRecording && recordedNotes.length > 0 && (
          <>
            <input
              type="text"
              placeholder="Pattern name..."
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              className="flex-1 bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={savePattern}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all text-sm"
            >
              💾 SAVE
            </button>
            <button
              onClick={discardRecording}
              className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-bold transition-all text-sm"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

