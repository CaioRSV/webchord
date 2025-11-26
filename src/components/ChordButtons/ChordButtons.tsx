import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { generateChord, getChordName } from '../../music/chords';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';

interface ChordButtonsProps {
  audioEngine: WasmAudioEngine | null;
}

const CHORD_NAMES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const CHORD_COLORS = [
  'green',   // I - Major
  'blue',    // ii - Minor
  'blue',    // iii - Minor
  'green',   // IV - Major
  'green',   // V - Major
  'blue',    // vi - Minor
  'purple',  // vii° - Diminished
];

export default function ChordButtons({ audioEngine }: ChordButtonsProps) {
  const [activeButtons, setActiveButtons] = useState<Set<number>>(new Set());
  const [activeNotes, setActiveNotes] = useState<Map<number, number[]>>(new Map());
  const [arpIntervals, setArpIntervals] = useState<Map<number, ReturnType<typeof setInterval>>>(new Map());
  
  // Use refs to track state synchronously to prevent race conditions
  const activeButtonsRef = useRef<Set<number>>(new Set());
  const activeNotesRef = useRef<Map<number, number[]>>(new Map());
  const arpIntervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const pressedKeysRef = useRef<Set<string>>(new Set()); // Track keyboard keys to prevent repeat events
  
  // Global MIDI note tracking - tracks which buttons are holding each note
  // This prevents shared notes from being cut off when one chord releases
  const globalMidiNotesRef = useRef<Map<number, Set<number>>>(new Map()); // Map<midiNote, Set<buttonDegree>>
  
  // Electric piano velocity tracking
  const buttonPressTimeRef = useRef<Map<number, number>>(new Map());
  const lastVelocityRef = useRef<Map<number, number>>(new Map());
  
  const key = useAppStore((state) => state.music.key);
  const mode = useAppStore((state) => state.music.mode);
  const globalOctave = useAppStore((state) => state.music.globalOctave);
  const chordButtons = useAppStore((state) => state.music.chordButtons);
  const releaseMode = useAppStore((state) => state.audio.releaseMode);
  const currentMode = useAppStore((state) => state.audio.currentMode);
  const arpSettings = useAppStore((state) => state.playback.arpeggiator);
  const bpm = useAppStore((state) => state.audio.bpm);

  const handleButtonDown = (degree: number, eventTime?: number) => {
    // Check ref instead of state to prevent race conditions
    if (!audioEngine || activeButtonsRef.current.has(degree)) {
      console.log('Button already active or no audio engine:', degree);
      return;
    }

    try {
      console.log('🎵 Button down:', degree);
      
      // Track press time for velocity calculation
      const pressTime = eventTime || performance.now();
      buttonPressTimeRef.current.set(degree, pressTime);
      
      // Record note if recording is active
      const isRecording = useAppStore.getState().sequencer.isRecording;
      const recordingStartTime = useAppStore.getState().sequencer.recordingStartTime;
      
      const chord = generateChord(
        key,
        degree + 1,
        undefined,
        chordButtons[degree].inversion,
        globalOctave + chordButtons[degree].octaveOffset
      );

      // Update refs immediately (synchronous)
      activeButtonsRef.current.add(degree);
      activeNotesRef.current.set(degree, chord);

      console.log(`🎮 Mode: ${currentMode}, Recording: ${isRecording}, Button: ${degree}`);

      if (currentMode === 'play') {
        // Electric piano: calculate velocity based on press speed
        // Default to medium velocity (0.7) for keyboard/immediate presses
        let velocity = 0.7;
        
        // Store velocity for this button
        lastVelocityRef.current.set(degree, velocity);
        
        // Handle recording - prepare all notes before state update to avoid race conditions
        const notesToRecord: Array<{ midiNote: number; velocity: number; degree: number }> = [];
        let isFirstChord = false;
        
        if (isRecording) {
          isFirstChord = recordingStartTime === 0;
          chord.forEach((midiNote) => {
            notesToRecord.push({ midiNote, velocity, degree: degree + 1 });
          });
        }
        
        // Standard play mode with velocity
        chord.forEach((midiNote) => {
          // Track which buttons are holding this MIDI note
          if (!globalMidiNotesRef.current.has(midiNote)) {
            globalMidiNotesRef.current.set(midiNote, new Set());
          }
          const holdingButtons = globalMidiNotesRef.current.get(midiNote)!;
          
          // Only trigger noteOn if this note isn't already playing
          const isAlreadyPlaying = holdingButtons.size > 0;
          holdingButtons.add(degree);
          
          if (!isAlreadyPlaying) {
            audioEngine.noteOn(midiNote, velocity);
            console.log(`🎵 noteOn: ${midiNote} (button ${degree})`);
          } else {
            console.log(`♻️ Shared note: ${midiNote} (button ${degree} joins ${Array.from(holdingButtons).join(',')})`);
          }
        });
        
        // Dispatch chord played event for suggestion system
        window.dispatchEvent(new CustomEvent('chordPlayed', {
          detail: { degree, timestamp: pressTime }
        }));
        
        // Record all notes at once after playing to avoid race conditions
        if (isRecording && notesToRecord.length > 0) {
          if (isFirstChord) {
            console.log('Recording started with', notesToRecord.length, 'notes at', pressTime);
            useAppStore.setState((state) => ({
              sequencer: {
                ...state.sequencer,
                recordingStartTime: pressTime,
                recordedNotes: notesToRecord.map(n => ({
                  time: 0,
                  type: 'noteOn' as const,
                  midiNote: n.midiNote,
                  velocity: n.velocity,
                  degree: n.degree,
                })),
              },
            }));
          } else {
            const relativeTime = pressTime - recordingStartTime;
            console.log('Recording', notesToRecord.length, 'notes at', relativeTime);
            useAppStore.setState((state) => ({
              sequencer: {
                ...state.sequencer,
                recordedNotes: [
                  ...state.sequencer.recordedNotes,
                  ...notesToRecord.map(n => ({
                    time: relativeTime,
                    type: 'noteOn' as const,
                    midiNote: n.midiNote,
                    velocity: n.velocity,
                    degree: n.degree,
                  })),
                ],
              },
            }));
          }
        }
        
        setActiveNotes((prev) => new Map(prev).set(degree, chord));
      } else if (currentMode === 'arpeggiator') {
        // Arpeggiator mode - proper implementation (NO full chord recording, only arp notes)
        console.log(`🎹 Starting arpeggiator for chord:`, chord);
        
        // Dispatch chord played event for suggestion system
        window.dispatchEvent(new CustomEvent('chordPlayed', {
          detail: { degree, timestamp: pressTime }
        }));
        
        const arpChord = [...chord];
        const baseVelocity = lastVelocityRef.current.get(degree) || 0.7;
        
        // Extend chord across octaves if needed
        const extendedChord: number[] = [];
        for (let oct = 0; oct < arpSettings.octaves; oct++) {
          arpChord.forEach(note => extendedChord.push(note + (oct * 12)));
        }
        
        // Apply pattern
        let arpNotes = [...extendedChord];
        if (arpSettings.pattern === 'down') {
          arpNotes.reverse();
        } else if (arpSettings.pattern === 'updown') {
          // Remove duplicate note in the middle
          const up = [...arpNotes];
          const down = [...arpNotes].reverse();
          arpNotes = [...up.slice(0, -1), ...down.slice(0, -1)];
        }
        
        let currentNoteIndex = 0;
        let currentPlayingNote: number | null = null;
        let noteOffTimeout: ReturnType<typeof setTimeout> | null = null;
        
        // Calculate arp speed based on BPM and speed multiplier
        const baseInterval = (60 / bpm / 4) * 1000; // 16th note
        const arpInterval = baseInterval / arpSettings.speed;
        const noteLength = arpInterval * arpSettings.gate;
        
        // Arpeggiator playback function
        const playNote = () => {
          // Clear any pending note-off
          if (noteOffTimeout) {
            clearTimeout(noteOffTimeout);
            noteOffTimeout = null;
          }
          
          // Stop previous note immediately for clean transition
          if (currentPlayingNote !== null) {
            audioEngine.noteOff(currentPlayingNote, true);
            currentPlayingNote = null;
          }
          
          // Select next note
          let noteToPlay;
          if (arpSettings.pattern === 'random') {
            noteToPlay = arpNotes[Math.floor(Math.random() * arpNotes.length)];
          } else {
            noteToPlay = arpNotes[currentNoteIndex % arpNotes.length];
            currentNoteIndex++;
          }
          
          // Play note immediately (all audio is from Rust WASM)
          const velocity = baseVelocity * (0.95 + Math.random() * 0.1);
          const currentTime = performance.now();
          audioEngine.noteOn(noteToPlay, velocity);
          currentPlayingNote = noteToPlay;
          
          // Record arpeggiated note if recording (ONLY individual arp notes, never full chord)
          const isRecording = useAppStore.getState().sequencer.isRecording;
          const recordingStartTime = useAppStore.getState().sequencer.recordingStartTime;
          
          if (isRecording) {
            // Start recording on first arp note if not started yet
            if (recordingStartTime === 0) {
              console.log(`🎙️ Arpeggiator recording started - First note: ${noteToPlay} at`, currentTime);
              useAppStore.setState((state) => ({
                sequencer: {
                  ...state.sequencer,
                  recordingStartTime: currentTime,
                  recordedNotes: [
                    {
                      time: 0,
                      type: 'noteOn' as const,
                      midiNote: noteToPlay,
                      velocity,
                      degree: degree + 1,
                    },
                  ],
                },
              }));
            } else {
              // Record subsequent arp notes
              const relativeTime = currentTime - recordingStartTime;
              console.log(`🎙️ Arpeggiator recording note: ${noteToPlay} at ${relativeTime}ms`);
              useAppStore.setState((state) => ({
                sequencer: {
                  ...state.sequencer,
                  recordedNotes: [
                    ...state.sequencer.recordedNotes,
                    {
                      time: relativeTime,
                      type: 'noteOn' as const,
                      midiNote: noteToPlay,
                      velocity,
                      degree: degree + 1,
                    },
                  ],
                },
              }));
            }
          }
          
          // Schedule note off based on gate length
          if (arpSettings.gate < 1.0) {
            noteOffTimeout = setTimeout(() => {
              if (currentPlayingNote === noteToPlay) {
                const noteOffTime = performance.now();
                audioEngine.noteOff(noteToPlay, true);
                
                // Record noteOff if recording
                if (isRecording && recordingStartTime > 0) {
                  const relativeTime = noteOffTime - recordingStartTime;
                  useAppStore.setState((state) => ({
                    sequencer: {
                      ...state.sequencer,
                      recordedNotes: [
                        ...state.sequencer.recordedNotes,
                        {
                          time: relativeTime,
                          type: 'noteOff',
                          midiNote: noteToPlay,
                          velocity: 0,
                          degree: degree + 1,
                        },
                      ],
                    },
                  }));
                }
                
                currentPlayingNote = null;
              }
              noteOffTimeout = null;
            }, noteLength);
          }
        };
        
        // Start arpeggiator
        playNote(); // Play first note immediately
        const interval = setInterval(playNote, arpInterval);
        
        // Store interval for cleanup
        arpIntervalsRef.current.set(degree, interval);
        setArpIntervals((prev) => new Map(prev).set(degree, interval));
        setActiveNotes((prev) => new Map(prev).set(degree, arpNotes));
      }

      setActiveButtons((prev) => new Set([...prev, degree]));
    } catch (error) {
      console.error('Error playing chord:', error);
    }
  };

  const handleButtonUp = (degree: number) => {
    if (!audioEngine) return;
    
    // Check if button is actually active in ref
    if (!activeButtonsRef.current.has(degree)) {
      console.log('Button not active, skipping release:', degree);
      return;
    }

    try {
      console.log('🎵 Button up:', degree);
      
      // Clear any arpeggiator or repeat intervals immediately
      const interval = arpIntervalsRef.current.get(degree);
      if (interval) {
        clearInterval(interval);
        arpIntervalsRef.current.delete(degree);
        setArpIntervals((prev) => {
          const newMap = new Map(prev);
          newMap.delete(degree);
          return newMap;
        });
      }

      // Get the stored MIDI notes from ref
      const chord = activeNotesRef.current.get(degree);
      
      if (chord) {
        // Stop all notes immediately when releasing in arp/repeat mode
        // Use envelope release in play mode for natural piano feel
        const immediate = currentMode !== 'play';
        
        // Record noteOff if recording
        const isRecording = useAppStore.getState().sequencer.isRecording;
        const recordingStartTime = useAppStore.getState().sequencer.recordingStartTime;
        const releaseTime = performance.now();
        
        chord.forEach((midiNote) => {
          // Remove this button from the note's holding set
          const holdingButtons = globalMidiNotesRef.current.get(midiNote);
          if (holdingButtons) {
            holdingButtons.delete(degree);
            
            // Only call noteOff if NO other buttons are holding this note
            if (holdingButtons.size === 0) {
              audioEngine.noteOff(midiNote, immediate);
              globalMidiNotesRef.current.delete(midiNote);
              console.log(`🔇 noteOff: ${midiNote} (button ${degree} released, no other holders)`);
            } else {
              console.log(`♻️ Note continues: ${midiNote} (button ${degree} released, still held by ${Array.from(holdingButtons).join(',')})`);
            }
          }
          
          if (isRecording && recordingStartTime > 0) {
            const relativeTime = releaseTime - recordingStartTime;
            console.log('Recording noteOff:', { midiNote, relativeTime, degree: degree + 1 });
            
            useAppStore.setState((state) => ({
              sequencer: {
                ...state.sequencer,
                recordedNotes: [
                  ...state.sequencer.recordedNotes,
                  {
                    time: relativeTime,
                    type: 'noteOff' as const,
                    midiNote,
                    velocity: 0,
                    degree: degree + 1,
                  },
                ],
              },
            }));
          }
        });
      }

      // Clean up refs immediately (synchronous)
      activeButtonsRef.current.delete(degree);
      activeNotesRef.current.delete(degree);
      buttonPressTimeRef.current.delete(degree);
      lastVelocityRef.current.delete(degree);

      // Clean up state (async)
      setActiveNotes((prev) => {
        const newMap = new Map(prev);
        newMap.delete(degree);
        return newMap;
      });
      setActiveButtons((prev) => {
        const newSet = new Set(prev);
        newSet.delete(degree);
        return newSet;
      });
    } catch (error) {
      console.error('Error stopping chord:', error);
    }
  };

  // Keyboard support - using refs to avoid recreating handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '7') {
        e.preventDefault(); // Prevent browser shortcuts
        
        // Prevent keyboard repeat events (holding key down)
        if (pressedKeysRef.current.has(key)) {
          console.log('Key already pressed, ignoring repeat:', key);
          return;
        }
        
        pressedKeysRef.current.add(key);
        const degree = parseInt(key) - 1;
        handleButtonDown(degree);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '1' && key <= '7') {
        e.preventDefault();
        
        // Remove from pressed keys
        pressedKeysRef.current.delete(key);
        
        const degree = parseInt(key) - 1;
        handleButtonUp(degree);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Clean up any active intervals
      arpIntervalsRef.current.forEach((interval) => clearInterval(interval));
    };
  }, [key, mode, globalOctave, chordButtons, audioEngine, currentMode, arpSettings, bpm, releaseMode]);
  
  // Sync refs with state
  useEffect(() => {
    activeButtonsRef.current = activeButtons;
  }, [activeButtons]);
  
  useEffect(() => {
    activeNotesRef.current = activeNotes;
  }, [activeNotes]);
  
  useEffect(() => {
    arpIntervalsRef.current = arpIntervals;
  }, [arpIntervals]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-white text-sm font-bold">🎹 CHORD BUTTONS</h2>
        <button
          onClick={() => {
            useAppStore.setState((state) => ({
              audio: {
                ...state.audio,
                releaseMode: state.audio.releaseMode === 'fixed' ? 'immediate' : 'fixed',
              },
            }));
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            releaseMode === 'fixed'
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md'
          }`}
        >
          {releaseMode === 'fixed' ? '🎹 Fixed' : '⚡ Instant'}
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {CHORD_NAMES.map((name, index) => {
          const isActive = activeButtons.has(index);
          const chordName = getChordName(key, index + 1);
          const color = CHORD_COLORS[index];

          return (
            <button
              key={index}
              onMouseDown={() => {
                const pressTime = performance.now();
                handleButtonDown(index, pressTime);
              }}
              onMouseUp={() => handleButtonUp(index)}
              onMouseLeave={() => {
                if (isActive) handleButtonUp(index);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const pressTime = performance.now();
                handleButtonDown(index, pressTime);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleButtonUp(index);
              }}
              className={`
                relative p-4 rounded-lg font-bold transition-all duration-150 cursor-pointer select-none group
                ${isActive
                  ? color === 'green'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white scale-[1.02] shadow-xl shadow-green-500/30 ring-2 ring-green-400'
                    : color === 'blue'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white scale-[1.02] shadow-xl shadow-blue-500/30 ring-2 ring-blue-400'
                    : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white scale-[1.02] shadow-xl shadow-purple-500/30 ring-2 ring-purple-400'
                  : 'bg-gradient-to-br from-slate-700 to-slate-800 text-slate-300 hover:from-slate-600 hover:to-slate-700 hover:scale-[1.01] hover:shadow-lg'
                }
              `}
            >
              <div className="text-xl font-black mb-1 group-hover:scale-110 transition-transform">{index + 1}</div>
              <div className="text-xs font-bold opacity-90">{name}</div>
              <div className="text-xs mt-0.5 opacity-60 truncate">{chordName}</div>
            </button>
          );
        })}
      </div>
      <p className="text-slate-400 text-xs mt-2 text-center">
        Keys 1-7 or click to play
      </p>
    </div>
  );
}

