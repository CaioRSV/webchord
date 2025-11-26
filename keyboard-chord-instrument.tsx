import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

export default function ChordInstrument() {
  const [isStarted, setIsStarted] = useState(false);
  const [activeKeys, setActiveKeys] = useState(new Set());
  const [volume, setVolume] = useState(-18);
  const [rootNote, setRootNote] = useState('C');
  const [octave, setOctave] = useState(3);
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [steps, setSteps] = useState(16);
  const [activeRows, setActiveRows] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [pattern, setPattern] = useState(
    Array(7).fill(null).map(() => Array(16).fill(false))
  );
  
  const synthRef = useRef(null);
  const volumeNodeRef = useRef(null);
  const activeNotesRef = useRef({});
  const sequenceRef = useRef(null);
  const reverbRef = useRef(null);
  const delayRef = useRef(null);
  const chorusRef = useRef(null);

  const scaleIntervals = [0, 2, 4, 5, 7, 9, 11];
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  const chordQualities = [
    { name: 'I', type: 'maj7', intervals: [0, 4, 7, 11], color: 'green' },
    { name: 'II', type: 'min7', intervals: [0, 3, 7, 10], color: 'blue' },
    { name: 'III', type: 'min7', intervals: [0, 3, 7, 10], color: 'blue' },
    { name: 'IV', type: 'maj7', intervals: [0, 4, 7, 11], color: 'green' },
    { name: 'V', type: 'sus2', intervals: [0, 2, 7], color: 'yellow' },
    { name: 'VI', type: 'min7', intervals: [0, 3, 7, 10], color: 'blue' },
    { name: 'VII', type: 'min7b5', intervals: [0, 3, 6, 10], color: 'purple' }
  ];

  const keyMap = {
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6
  };

  const getNoteFromInterval = (semitones, baseOctave) => {
    const rootIndex = notes.indexOf(rootNote);
    const totalSemitones = rootIndex + semitones;
    const noteIndex = totalSemitones % 12;
    const octaveOffset = Math.floor(totalSemitones / 12);
    return notes[noteIndex] + (baseOctave + octaveOffset);
  };

  const generateChord = (degree) => {
    const scaleRoot = scaleIntervals[degree];
    const quality = chordQualities[degree];
    
    return quality.intervals.map(interval => 
      getNoteFromInterval(scaleRoot + interval, octave)
    );
  };

  useEffect(() => {
    volumeNodeRef.current = new Tone.Volume(volume).toDestination();
    
    reverbRef.current = new Tone.Reverb({
      decay: 4,
      wet: 0.5
    }).connect(volumeNodeRef.current);
    
    delayRef.current = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.3,
      wet: 0.2
    }).connect(reverbRef.current);
    
    chorusRef.current = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.5,
      wet: 0.3
    }).connect(delayRef.current);
    
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      volume: 0,
      oscillator: { 
        type: 'sine',
        partials: [1, 0, 2, 0, 3]
      },
      envelope: {
        attack: 0.08,
        decay: 0.6,
        sustain: 0.5,
        release: 3
      },
      filter: {
        type: 'lowpass',
        frequency: 2000,
        rolloff: -12
      },
      filterEnvelope: {
        attack: 0.1,
        decay: 0.4,
        sustain: 0.6,
        release: 2,
        baseFrequency: 300,
        octaves: 2.5
      }
    }).connect(chorusRef.current);

    return () => {
      if (synthRef.current) synthRef.current.dispose();
      if (chorusRef.current) chorusRef.current.dispose();
      if (delayRef.current) delayRef.current.dispose();
      if (reverbRef.current) reverbRef.current.dispose();
      if (volumeNodeRef.current) volumeNodeRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (volumeNodeRef.current) {
      volumeNodeRef.current.volume.rampTo(volume, 0.1);
    }
  }, [volume]);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (isPlaying && isStarted) {
      Tone.Transport.start();
      
      sequenceRef.current = new Tone.Sequence(
        (time, step) => {
          setCurrentStep(step);
          
          pattern.forEach((row, chordIndex) => {
            if (row[step] && activeRows.includes(chordIndex)) {
              const chord = generateChord(chordIndex);
              synthRef.current.triggerAttackRelease(chord, '8n', time);
            }
          });
        },
        [...Array(steps).keys()],
        '16n'
      ).start(0);
    } else {
      Tone.Transport.stop();
      if (sequenceRef.current) {
        sequenceRef.current.dispose();
        sequenceRef.current = null;
      }
      setCurrentStep(-1);
    }

    return () => {
      if (sequenceRef.current) {
        sequenceRef.current.dispose();
      }
    };
  }, [isPlaying, isStarted, pattern, rootNote, octave, activeRows]);

  const playChord = (key) => {
    if (!isStarted) return;
    
    const degree = keyMap[key];
    if (degree === undefined) return;
    
    const chord = generateChord(degree);
    const now = Tone.now();
    
    synthRef.current.triggerAttack(chord, now);
    activeNotesRef.current[key] = chord;
    setActiveKeys(prev => new Set([...prev, key]));
  };

  const stopChord = (key) => {
    if (activeNotesRef.current[key]) {
      const now = Tone.now();
      synthRef.current.triggerRelease(activeNotesRef.current[key], now);
      delete activeNotesRef.current[key];
    }
    setActiveKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keyMap[key] !== undefined && !activeKeys.has(key)) {
        playChord(key);
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keyMap[key] !== undefined) {
        stopChord(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStarted, activeKeys, rootNote, octave]);

  const startAudio = async () => {
    await Tone.start();
    setIsStarted(true);
  };

  const toggleCell = (chordIndex, stepIndex) => {
    setPattern(prev => {
      const newPattern = prev.map(row => [...row]);
      newPattern[chordIndex][stepIndex] = !newPattern[chordIndex][stepIndex];
      return newPattern;
    });
  };

  const toggleRow = (chordIndex) => {
    setActiveRows(prev => {
      if (prev.includes(chordIndex)) {
        return prev.filter(i => i !== chordIndex);
      } else {
        return [...prev, chordIndex].sort((a, b) => a - b);
      }
    });
  };

  const clearPattern = () => {
    setPattern(Array(7).fill(null).map(() => Array(steps).fill(false)));
  };

  const addColumns = (count) => {
    setPattern(prev => prev.map(row => [...row, ...Array(count).fill(false)]));
    setSteps(prev => prev + count);
  };

  const removeColumns = (count) => {
    if (steps - count < 4) return; // Minimum 4 steps
    setPattern(prev => prev.map(row => row.slice(0, steps - count)));
    setSteps(prev => prev - count);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center p-4">
      <div className="max-w-7xl w-full">
        <h1 className="text-4xl font-bold text-white text-center mb-2 mt-4">
          Dreamy Chord Sequencer
        </h1>
        <p className="text-blue-300 text-center mb-6">
          Click grid to program patterns • Press 1-7 for live play
        </p>

        {!isStarted && (
          <div className="text-center mb-6">
            <button
              onClick={startAudio}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-full text-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg"
            >
              Start Audio Engine
            </button>
          </div>
        )}

        {isStarted && (
          <>
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 mb-6 border border-slate-700">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <label className="text-white text-sm font-semibold mb-2 block">Root Note</label>
                  <select
                    value={rootNote}
                    onChange={(e) => setRootNote(e.target.value)}
                    className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  >
                    {notes.map(note => (
                      <option key={note} value={note}>{note}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-white text-sm font-semibold mb-2 block">Octave</label>
                  <select
                    value={octave}
                    onChange={(e) => setOctave(Number(e.target.value))}
                    className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  >
                    {[2, 3, 4, 5].map(oct => (
                      <option key={oct} value={oct}>{oct}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-white text-sm font-semibold mb-2 block">BPM</label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    min="40"
                    max="240"
                    className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-white text-sm font-semibold mb-2 block">Steps: {steps}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => removeColumns(4)}
                      disabled={steps <= 4}
                      className="flex-1 px-2 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-semibold transition-all text-sm"
                    >
                      -4
                    </button>
                    <button
                      onClick={() => addColumns(4)}
                      className="flex-1 px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-all text-sm"
                    >
                      +4
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-white text-sm font-semibold mb-2 block">Volume</label>
                  <input
                    type="range"
                    min="-40"
                    max="0"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                  <div className="text-blue-300 text-xs text-center">{volume} dB</div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-4 py-2 rounded font-semibold transition-all ${
                      isPlaying 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {isPlaying ? '⏸ Stop' : '▶ Play'}
                  </button>
                  <button
                    onClick={clearPattern}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-semibold transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Live Play Feedback */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 mb-6 border border-slate-700">
              <div className="text-white text-sm font-semibold mb-3">Live Play</div>
              <div className="flex gap-2 flex-wrap">
                {chordQualities.map((chord, index) => {
                  const key = String(index + 1);
                  const isActive = activeKeys.has(key);
                  return (
                    <div
                      key={index}
                      className={`px-4 py-2 rounded-lg font-bold transition-all ${
                        isActive
                          ? chord.color === 'green' ? 'bg-green-500 text-white scale-110 shadow-lg' :
                            chord.color === 'blue' ? 'bg-blue-500 text-white scale-110 shadow-lg' :
                            chord.color === 'yellow' ? 'bg-yellow-500 text-white scale-110 shadow-lg' :
                            'bg-purple-500 text-white scale-110 shadow-lg'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {key} - {chord.name} {chord.type}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700 overflow-x-auto">
              <div className="min-w-max">
                <div className="flex mb-2">
                  <div className="w-32 flex-shrink-0"></div>
                  <div className="flex gap-1">
                    {[...Array(steps)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-12 h-6 flex items-center justify-center text-xs font-mono ${
                          i % 4 === 0 ? 'text-white font-bold' : 'text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>

                {chordQualities.map((chord, chordIndex) => {
                  const isRowActive = activeRows.includes(chordIndex);
                  return (
                    <div key={chordIndex} className={`flex mb-1 items-center transition-opacity ${isRowActive ? 'opacity-100' : 'opacity-40'}`}>
                      <div className="w-32 flex-shrink-0 pr-2 flex items-center gap-2">
                        <button
                          onClick={() => toggleRow(chordIndex)}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                            isRowActive 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : 'bg-slate-600 hover:bg-slate-500'
                          }`}
                        >
                          {isRowActive ? '✓' : ''}
                        </button>
                        <div className="bg-slate-700 rounded px-2 py-1 flex-1 text-center">
                          <div className="text-white text-xs font-bold">{chord.name}</div>
                          <div className={`text-xs ${
                            chord.color === 'green' ? 'text-green-400' :
                            chord.color === 'blue' ? 'text-blue-400' :
                            chord.color === 'yellow' ? 'text-yellow-400' :
                            'text-purple-400'
                          }`}>
                            {chord.type}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {pattern[chordIndex].map((isActive, stepIndex) => (
                          <button
                            key={stepIndex}
                            onClick={() => toggleCell(chordIndex, stepIndex)}
                            disabled={!isRowActive}
                            className={`w-12 h-12 rounded transition-all ${
                              currentStep === stepIndex && isPlaying && isRowActive
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800'
                                : ''
                            } ${
                              isActive && isRowActive
                                ? 'bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg'
                                : stepIndex % 4 === 0
                                ? 'bg-slate-700 hover:bg-slate-600'
                                : 'bg-slate-700/50 hover:bg-slate-600'
                            } ${
                              !isRowActive ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center mt-6">
              <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-3 inline-block border border-slate-700">
                <p className="text-blue-300 text-sm">
                  Current key: <span className="font-bold text-white">{rootNote} Major</span> • 
                  Click ✓ button to enable/disable rows • 
                  Press 1-7 keys for live performance
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}