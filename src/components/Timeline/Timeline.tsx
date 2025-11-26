import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Pattern, TimelineClip, RecordedNote } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { generateChord } from '../../music/chords';

interface TimelineProps {
  audioEngine: WasmAudioEngine | null;
}

export default function Timeline({ audioEngine }: TimelineProps) {
  const patterns = useAppStore((state) => state.sequencer.patterns);
  const timeline = useAppStore((state) => state.sequencer.timeline);
  const isPlaying = useAppStore((state) => state.sequencer.isPlaying);
  const playbackPosition = useAppStore((state) => state.sequencer.playbackPosition);
  const bpm = useAppStore((state) => state.audio.bpm);
  const key = useAppStore((state) => state.music.key);
  const globalOctave = useAppStore((state) => state.music.globalOctave);
  
  const [draggedPattern, setDraggedPattern] = useState<Pattern | null>(null);
  const [draggedClip, setDraggedClip] = useState<TimelineClip | null>(null);
  const [dragOverTrack, setDragOverTrack] = useState<number | null>(null);
  const [trackCount, setTrackCount] = useState(4);
  const [totalBeats, setTotalBeats] = useState(32);
  const [isLooping, setIsLooping] = useState(true);
  const playbackRef = useRef<{ 
    timelineNotes: Map<number, number>; 
    lastTime: number;
    activeClips: Map<string, Set<number>>; // Track which notes each clip is currently playing
    hasLooped: boolean;
    activeClipsWithParams: Set<string>; // Track which clips have applied their parameters
    currentParametersClipId: string | null; // Which clip's parameters are currently active
  }>({
    timelineNotes: new Map(),
    lastTime: 0,
    activeClips: new Map(),
    hasLooped: false,
    activeClipsWithParams: new Set(),
    currentParametersClipId: null,
  });

  const BEAT_WIDTH = 60; // pixels per beat
  
  const beatsToPixels = (beats: number) => beats * BEAT_WIDTH;
  const pixelsToBeats = (pixels: number) => Math.round(pixels / BEAT_WIDTH);

  const addTrack = () => {
    setTrackCount((prev) => prev + 1);
  };

  const removeTrack = () => {
    if (trackCount > 1) {
      setTrackCount((prev) => prev - 1);
    }
  };

  const addBeats = (count: number) => {
    setTotalBeats((prev) => prev + count);
  };

  const removeBeats = (count: number) => {
    if (totalBeats - count >= 8) {
      setTotalBeats((prev) => prev - count);
    }
  };

  // Playback engine (handles timeline clips)
  useEffect(() => {
    if (!isPlaying || !audioEngine) return;

    // Calculate the end point of the rightmost clip
    let loopEndBeat = 0;
    timeline.forEach((clip) => {
      const pattern = patterns.find((p) => p.id === clip.patternId);
      if (pattern) {
        const clipLengthBeats = (pattern.length * bpm) / 60;
        const clipEndBeat = clip.startTime + clipLengthBeats;
        loopEndBeat = Math.max(loopEndBeat, clipEndBeat);
      }
    });
    
    // If no clips, use totalBeats as fallback
    if (loopEndBeat === 0) {
      loopEndBeat = totalBeats;
    } else {
      // Round up to nearest beat for clean loop
      loopEndBeat = Math.ceil(loopEndBeat);
    }

    console.log('Starting playback with', timeline.length, 'clips', 
                isLooping ? `(looping at beat ${loopEndBeat})` : '(one-shot)',
                `loop end: ${loopEndBeat} beats`);
    
    const startTime = performance.now();
    const beatDuration = (60 / bpm) * 1000; // ms per beat
    const scheduledNotes = new Set<string>(); // Track already scheduled notes
    playbackRef.current.hasLooped = false;

    const playbackInterval = setInterval(() => {
      const elapsedMs = performance.now() - startTime;
      const elapsedBeats = elapsedMs / beatDuration;
      
      // Check if we've reached the end and should stop (non-looping mode)
      if (!isLooping && elapsedBeats >= loopEndBeat) {
        console.log(`🛑 Timeline reached end at beat ${loopEndBeat} (non-looping mode)`);
        stopPlayback();
        return;
      }
      
      const currentBeat = elapsedBeats % loopEndBeat;
      
      // Detect loop restart - clear scheduled notes so they can play again
      if (currentBeat < playbackRef.current.lastTime) {
        console.log('🔁 Loop detected - clearing scheduled notes for replay');
        scheduledNotes.clear();
        playbackRef.current.hasLooped = true;
      }
      
      useAppStore.setState((state) => ({
        sequencer: {
          ...state.sequencer,
          playbackPosition: currentBeat,
        },
      }));

      // Timeline clips playback
      timeline.forEach((clip) => {
        const pattern = patterns.find((p) => p.id === clip.patternId);
        if (!pattern) return;

        const clipStartBeat = clip.startTime;
        const clipLengthBeats = (pattern.length * bpm) / 60;
        const clipEndBeat = clipStartBeat + clipLengthBeats;
        
        const isClipPlaying = currentBeat >= clipStartBeat && currentBeat < clipEndBeat;

        if (isClipPlaying) {
          const relativeTimeMs = (currentBeat - clipStartBeat) * beatDuration;
          
          // Initialize clip tracking if not exists
          if (!playbackRef.current.activeClips.has(clip.id)) {
            playbackRef.current.activeClips.set(clip.id, new Set());
            
            // Apply captured parameters from this pattern (if they exist)
            if (pattern.capturedParameters && playbackRef.current.currentParametersClipId !== clip.id) {
              const params = pattern.capturedParameters;
              console.log(`🎨 Applying captured parameters from clip: ${clip.id}`);
              
              // Convert waveform string to number
              const waveformMap: Record<string, number> = {
                sine: 0, sawtooth: 1, square: 2, triangle: 3, fm: 4, piano: 5,
              };
              
              audioEngine.setWaveform(waveformMap[params.waveform]);
              audioEngine.setADSR(params.adsr.attack, params.adsr.decay, params.adsr.sustain, params.adsr.release);
              audioEngine.setFilterCutoff(params.filter.cutoff);
              audioEngine.setFilterResonance(params.filter.resonance);
              audioEngine.setFilterMode(params.filter.mode);
              audioEngine.setFilterEnabled(params.filter.enabled);
              audioEngine.setLFORate(params.lfo.rate);
              audioEngine.setLFODepth(params.lfo.depth);
              audioEngine.setLFOWaveform(params.lfo.waveform);
              audioEngine.setLFOToFilter(params.lfo.enabled);
              audioEngine.setDetune(params.detune);
              
              // Effects
              audioEngine.setGlideTime(params.effects.glide.enabled ? params.effects.glide.time : 0);
              audioEngine.setTremolo(params.effects.tremolo.enabled, params.effects.tremolo.rate, params.effects.tremolo.depth);
              audioEngine.setFlanger(params.effects.flanger.enabled, params.effects.flanger.rate, params.effects.flanger.depth, params.effects.flanger.feedback, params.effects.flanger.mix);
              audioEngine.setDelay(params.effects.delay.enabled, params.effects.delay.time, params.effects.delay.feedback, params.effects.delay.mix);
              audioEngine.setReverb(params.effects.reverb.enabled, params.effects.reverb.size, params.effects.reverb.damping);
              
              playbackRef.current.currentParametersClipId = clip.id;
              playbackRef.current.activeClipsWithParams.add(clip.id);
            }
          }
          
          pattern.notes.forEach((note) => {
            const noteKey = `${clip.id}-${note.time}-${note.midiNote}-${note.type}`;
            const timeDiff = Math.abs(relativeTimeMs - note.time);
            
            if (timeDiff < 20 && !scheduledNotes.has(noteKey)) {
              scheduledNotes.add(noteKey);
              
              if (note.type === 'noteOn') {
                audioEngine.noteOn(note.midiNote, note.velocity);
                // Track which notes this clip is playing
                playbackRef.current.activeClips.get(clip.id)?.add(note.midiNote);
                playbackRef.current.timelineNotes.set(note.midiNote, note.midiNote);
              } else if (note.type === 'noteOff') {
                audioEngine.noteOff(note.midiNote, false);
                // Remove from clip tracking
                playbackRef.current.activeClips.get(clip.id)?.delete(note.midiNote);
                playbackRef.current.timelineNotes.delete(note.midiNote);
              }
            }
          });
        } else if (playbackRef.current.activeClips.has(clip.id)) {
          // Clip just ended - force stop all its active notes
          const activeNotes = playbackRef.current.activeClips.get(clip.id);
          if (activeNotes && activeNotes.size > 0) {
            console.log(`🔇 Clip ${clip.id} ended, stopping ${activeNotes.size} stuck notes`);
            activeNotes.forEach((midiNote) => {
              audioEngine.noteOff(midiNote, true);
              playbackRef.current.timelineNotes.delete(midiNote);
            });
            activeNotes.clear();
          }
          playbackRef.current.activeClips.delete(clip.id);
          playbackRef.current.activeClipsWithParams.delete(clip.id);
          
          // If this was the clip controlling parameters, restore global parameters
          if (playbackRef.current.currentParametersClipId === clip.id) {
            console.log('🔄 Restoring global parameters');
            const currentState = useAppStore.getState();
            const waveformMap: Record<string, number> = {
              sine: 0, sawtooth: 1, square: 2, triangle: 3, fm: 4, piano: 5,
            };
            
            audioEngine.setWaveform(waveformMap[currentState.synthesis.waveform]);
            audioEngine.setADSR(currentState.synthesis.adsr.attack, currentState.synthesis.adsr.decay, currentState.synthesis.adsr.sustain, currentState.synthesis.adsr.release);
            audioEngine.setFilterCutoff(currentState.synthesis.filter.cutoff);
            audioEngine.setFilterResonance(currentState.synthesis.filter.resonance);
            audioEngine.setFilterMode(currentState.synthesis.filter.mode);
            audioEngine.setFilterEnabled(currentState.synthesis.filter.enabled);
            audioEngine.setLFORate(currentState.synthesis.lfo.rate);
            audioEngine.setLFODepth(currentState.synthesis.lfo.depth);
            audioEngine.setLFOWaveform(currentState.synthesis.lfo.waveform);
            audioEngine.setLFOToFilter(currentState.synthesis.lfo.enabled);
            audioEngine.setDetune(currentState.synthesis.detune);
            audioEngine.setGlideTime(currentState.effects.glide.enabled ? currentState.effects.glide.time : 0);
            audioEngine.setTremolo(currentState.effects.tremolo.enabled, currentState.effects.tremolo.rate, currentState.effects.tremolo.depth);
            audioEngine.setFlanger(currentState.effects.flanger.enabled, currentState.effects.flanger.rate, currentState.effects.flanger.depth, currentState.effects.flanger.feedback, currentState.effects.flanger.mix);
            audioEngine.setDelay(currentState.effects.delay.enabled, currentState.effects.delay.time, currentState.effects.delay.feedback, currentState.effects.delay.mix);
            audioEngine.setReverb(currentState.effects.reverb.enabled, currentState.effects.reverb.size, currentState.effects.reverb.damping);
            
            playbackRef.current.currentParametersClipId = null;
          }
        }
      });

      if (scheduledNotes.size > 1000) {
        scheduledNotes.clear();
      }

      playbackRef.current.lastTime = elapsedBeats;
    }, 10);

    return () => {
      clearInterval(playbackInterval);
      // Stop all timeline notes
      playbackRef.current.timelineNotes.forEach((note) => {
        audioEngine.noteOff(note, true);
      });
      playbackRef.current.timelineNotes.clear();
      playbackRef.current.activeClips.clear();
      console.log('Playback stopped');
    };
  }, [isPlaying, audioEngine, timeline, patterns, bpm, totalBeats, isLooping]);

  const handlePatternDragStart = (e: React.DragEvent, pattern: Pattern) => {
    setDraggedPattern(pattern);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', pattern.id);
    
    // Create drag image
    const dragEl = e.currentTarget as HTMLElement;
    if (dragEl) {
      e.dataTransfer.setDragImage(dragEl, dragEl.offsetWidth / 2, dragEl.offsetHeight / 2);
    }
  };

  const handleClipDragStart = (e: React.DragEvent, clip: TimelineClip) => {
    setDraggedClip(clip);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', clip.id);
    e.stopPropagation(); // Prevent track drag events
  };

  const handleTrackDragOver = (e: React.DragEvent, track: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedPattern ? 'copy' : 'move';
    setDragOverTrack(track);
  };

  const handleTrackDrop = (e: React.DragEvent, track: number) => {
    e.preventDefault();
    setDragOverTrack(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 32; // Subtract track label width
    const startBeat = Math.max(0, pixelsToBeats(x)); // Snap to grid, min 0

    if (draggedPattern) {
      // Create new clip from pattern
      const newClip: TimelineClip = {
        id: Date.now().toString(),
        patternId: draggedPattern.id,
        startTime: startBeat,
        track,
      };

      useAppStore.setState((state) => ({
        sequencer: {
          ...state.sequencer,
          timeline: [...state.sequencer.timeline, newClip],
        },
      }));

      console.log('Created clip:', newClip);
      setDraggedPattern(null);
    } else if (draggedClip) {
      // Move existing clip
      useAppStore.setState((state) => ({
        sequencer: {
          ...state.sequencer,
          timeline: state.sequencer.timeline.map((c) =>
            c.id === draggedClip.id
              ? { ...c, startTime: startBeat, track }
              : c
          ),
        },
      }));

      console.log('Moved clip to beat:', startBeat, 'track:', track);
      setDraggedClip(null);
    }
  };

  const handleTrackDragLeave = () => {
    setDragOverTrack(null);
  };

  const removeClip = (clipId: string) => {
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        timeline: state.sequencer.timeline.filter((c) => c.id !== clipId),
      },
    }));
  };

  const togglePlayback = () => {
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        isPlaying: !state.sequencer.isPlaying,
        playbackPosition: state.sequencer.isPlaying ? 0 : state.sequencer.playbackPosition,
      },
    }));
  };

  const stopPlayback = () => {
    // Immediately stop all active notes before changing state
    if (audioEngine) {
      playbackRef.current.timelineNotes.forEach((note) => {
        audioEngine.noteOff(note, true);
      });
      playbackRef.current.timelineNotes.clear();
      playbackRef.current.activeClips.clear();
      console.log('🛑 Stop: All notes silenced');
    }
    
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        isPlaying: false,
        playbackPosition: 0,
      },
    }));
  };


  const randomizeSteps = () => {
    // ===== MARKOV CHAIN-BASED CHORD PROGRESSION GENERATOR =====
    // Based on music theory research: common chord progressions and functional harmony
    
    // Transition probability matrix (Markov chain) - rows: current chord, cols: next chord
    // Weighted based on common progressions in popular music
    const transitionMatrix: { [key: number]: { [key: number]: number } } = {
      1: { 1: 0.05, 2: 0.15, 3: 0.10, 4: 0.25, 5: 0.25, 6: 0.15, 7: 0.05 }, // I → often goes to IV, V, vi
      2: { 1: 0.05, 2: 0.05, 3: 0.10, 4: 0.10, 5: 0.50, 6: 0.10, 7: 0.10 }, // ii → often goes to V (ii-V-I)
      3: { 1: 0.10, 2: 0.10, 3: 0.05, 4: 0.25, 5: 0.10, 6: 0.30, 7: 0.10 }, // iii → often goes to vi, IV
      4: { 1: 0.20, 2: 0.10, 3: 0.10, 4: 0.10, 5: 0.30, 6: 0.10, 7: 0.10 }, // IV → often goes to I, V
      5: { 1: 0.40, 2: 0.05, 3: 0.05, 4: 0.15, 5: 0.05, 6: 0.25, 7: 0.05 }, // V → often resolves to I or vi (deceptive)
      6: { 1: 0.10, 2: 0.15, 3: 0.10, 4: 0.25, 5: 0.25, 6: 0.05, 7: 0.10 }, // vi → often goes to IV, V, ii
      7: { 1: 0.50, 2: 0.10, 3: 0.10, 4: 0.10, 5: 0.10, 6: 0.05, 7: 0.05 }, // vii → often resolves to I
    };
    
    // Common progression templates (for variety)
    const progressionTemplates = [
      [1, 5, 6, 4],      // I-V-vi-IV (most popular pop progression)
      [1, 4, 5, 1],      // I-IV-V-I (classic rock)
      [6, 4, 1, 5],      // vi-IV-I-V (emotional progression)
      [1, 6, 4, 5],      // I-vi-IV-V (50s progression)
      [2, 5, 1],         // ii-V-I (jazz standard)
      [1, 4, 6, 5],      // I-IV-vi-V
      [6, 4, 5, 1],      // vi-IV-V-I
      [1, 3, 4, 5],      // I-iii-IV-V
    ];
    
    // Weighted random selection function
    const weightedRandom = (weights: { [key: number]: number }): number => {
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;
      
      for (const [degree, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) return parseInt(degree);
      }
      return 1; // Fallback to tonic
    };
    
    // Decide between template and Markov generation
    const useTemplate = Math.random() < 0.6; // 60% use templates, 40% Markov
    let progression: number[];
    
    if (useTemplate) {
      // Use a template and optionally extend it
      const template = progressionTemplates[Math.floor(Math.random() * progressionTemplates.length)];
      const shouldExtend = Math.random() < 0.5;
      
      if (shouldExtend && template.length === 4) {
        // Extend with Markov chain
        progression = [...template];
        const extensionLength = Math.floor(Math.random() * 3) + 1; // 1-3 extra chords
        let currentChord = progression[progression.length - 1];
        
        for (let i = 0; i < extensionLength; i++) {
          const nextChord = weightedRandom(transitionMatrix[currentChord]);
          progression.push(nextChord);
          currentChord = nextChord;
        }
      } else {
        progression = template;
      }
    } else {
      // Pure Markov chain generation
      const length = Math.floor(Math.random() * 4) + 4; // 4-7 chords
      progression = [1]; // Start with tonic
      let currentChord = 1;
      
      for (let i = 1; i < length; i++) {
        const nextChord = weightedRandom(transitionMatrix[currentChord]);
        progression.push(nextChord);
        currentChord = nextChord;
      }
    }
    
    // Ensure progression ends on a strong resolution (I or V) for better musicality
    const lastChord = progression[progression.length - 1];
    if (lastChord !== 1 && lastChord !== 5 && Math.random() < 0.7) {
      progression.push(1); // Add tonic resolution
    }
    
    // Euclidean rhythm generator reserved for future use
    // const euclideanRhythm = (steps: number, pulses: number): boolean[] => {
    //   if (pulses >= steps) return Array(steps).fill(true);
    //   if (pulses === 0) return Array(steps).fill(false);
    //   
    //   const pattern: boolean[] = Array(steps).fill(false);
    //   for (let i = 0; i < steps; i++) {
    //     if ((i * pulses) % steps < pulses) {
    //       pattern[i] = true;
    //     }
    //   }
    //   
    //   return pattern;
    // };
    
    // ===== PATTERN GENERATION =====
    const beatsPerChord = 4 / progression.length; // Distribute over 4 beats
    const patternLength = 4; // 4 seconds for 1 bar at 120 BPM
    const notes: RecordedNote[] = [];
    
    // Generate chords with musical timing and dynamics
    progression.forEach((degree, index) => {
      const startBeat = index * beatsPerChord;
      const startTime = (startBeat / 4) * patternLength * 1000; // Convert to ms
      
      // Add micro-timing variations for human feel (±30ms)
      const humanize = (Math.random() - 0.5) * 30;
      const actualStartTime = startTime + humanize;
      
      // Dynamic velocity based on position (louder on downbeats)
      const isDownbeat = index % 4 === 0;
      const baseVelocity = isDownbeat ? 0.85 : 0.65;
      const velocityVariation = Math.random() * 0.15;
      const velocity = Math.max(0.5, Math.min(1.0, baseVelocity + velocityVariation));
      
      try {
        const chord = generateChord(key, degree, undefined, 0, globalOctave);
        
        // Stagger note-on times slightly for more natural sound (arpeggio effect)
        chord.forEach((midiNote, noteIndex) => {
          const noteStagger = noteIndex * 8; // 8ms between notes
          
          notes.push({
            midiNote,
            velocity,
            type: 'noteOn' as const,
            time: actualStartTime + noteStagger,
            degree: 0,
          });
        });
        
        // Note off with slight variation
        const noteDuration = (beatsPerChord / 4) * patternLength * 1000;
        const endTime = actualStartTime + (noteDuration * 0.85); // 85% duration
        
        chord.forEach((midiNote, noteIndex) => {
          const noteStagger = noteIndex * 5; // Slightly faster release stagger
          
          notes.push({
            midiNote,
            velocity,
            type: 'noteOff' as const,
            time: endTime + noteStagger,
            degree: 0,
          });
        });
      } catch (error) {
        console.error('Error generating chord:', error);
      }
    });
    
    // Create pattern with descriptive name
    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Generate descriptive name based on progression
    const progressionName = progression.map(d => {
      const romanNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
      return romanNumerals[d - 1];
    }).join('-');
    
    const newPattern: Pattern = {
      id: `pattern-${Date.now()}`,
      name: progressionName,
      length: patternLength,
      notes,
      color: randomColor,
    };
    
    // Add pattern to patterns list only (don't auto-place on timeline)
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        patterns: [...state.sequencer.patterns, newPattern],
      },
    }));
    
    console.log(`🎵 Generated pattern: ${progressionName}`);
    console.log(`   • Progression: ${progression.join(' → ')}`);
    console.log(`   • Method: ${useTemplate ? 'Template-based' : 'Markov chain'}`);
    console.log(`   • 📚 Added to Pattern Library - drag to timeline to use`);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-xl font-semibold">🎼 Timeline Arranger</h2>
        <div className="flex gap-2">
          <button
            onClick={togglePlayback}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              isPlaying
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={stopPlayback}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
          >
            ⏹ Stop
          </button>
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              isLooping
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
            }`}
            title={isLooping ? 'Loop enabled - timeline will repeat' : 'Loop disabled - timeline plays once'}
          >
            🔁 {isLooping ? 'Loop: ON' : 'Loop: OFF'}
          </button>
        </div>
      </div>

      {/* Timeline Controls */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm font-semibold">Tracks:</span>
          <button
            onClick={removeTrack}
            disabled={trackCount <= 1}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-all"
          >
            −
          </button>
          <span className="text-white text-sm font-mono w-8 text-center">{trackCount}</span>
          <button
            onClick={addTrack}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition-all"
          >
            +
          </button>
        </div>

        <div className="h-6 w-px bg-slate-600"></div>

        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-sm font-semibold">Beats:</span>
          <button
            onClick={() => removeBeats(8)}
            disabled={totalBeats <= 8}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-all"
          >
            −8
          </button>
          <button
            onClick={() => removeBeats(4)}
            disabled={totalBeats <= 8}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded text-xs font-bold transition-all"
          >
            −4
          </button>
          <span className="text-white text-sm font-mono w-12 text-center">{totalBeats}</span>
          <button
            onClick={() => addBeats(4)}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition-all"
          >
            +4
          </button>
          <button
            onClick={() => addBeats(8)}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold transition-all"
          >
            +8
          </button>
        </div>
      </div>

        {/* Step Sequencer (16 steps) - Horizontal Grid */}

      {/* Pattern Library - Drag & Drop to Timeline */}
      <div className="mb-4 bg-slate-900/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📚</span>
          <h3 className="text-white text-sm font-semibold">Pattern Library</h3>
          <span className="text-slate-400 text-xs">(Drag patterns to timeline tracks)</span>
          <button
            onClick={randomizeSteps}
            className="ml-auto px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition-all shadow-md"
            title="Generate a random chord progression and add to timeline"
          >
            🎲 Generate Pattern
          </button>
        </div>
        <div className="flex gap-2 flex-wrap p-3 bg-slate-900/50 rounded-lg min-h-[60px]">
          {patterns.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full py-4 text-center">
              <p className="text-slate-400 text-sm mb-2">📭 No patterns yet!</p>
              <p className="text-slate-500 text-xs">Record patterns above or click "Generate Pattern"</p>
            </div>
          ) : (
            patterns.map((pattern) => (
              <div
                key={pattern.id}
                draggable
                onDragStart={(e) => handlePatternDragStart(e, pattern)}
                className="px-3 py-2 rounded cursor-move hover:scale-105 transition-transform text-white text-sm font-semibold shadow-lg relative group"
                style={{ backgroundColor: pattern.color }}
                title="Drag to timeline track"
              >
                <div className="flex items-center gap-2">
                  <span>🎵 {pattern.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useAppStore.setState((state) => ({
                        sequencer: {
                          ...state.sequencer,
                          patterns: state.sequencer.patterns.filter(p => p.id !== pattern.id),
                          timeline: state.sequencer.timeline.filter(c => c.patternId !== pattern.id),
                        },
                      }));
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 px-1.5 py-0.5 bg-black/30 rounded hover:bg-black/50 transition-opacity text-xs"
                    title="Delete pattern"
                  >
                    ×
                  </button>
                </div>
                <span className="text-xs opacity-75 block mt-1">
                  {pattern.length.toFixed(1)}s • {pattern.notes.length} notes
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Timeline Tracks */}
      <div className="relative bg-slate-900/50 rounded-lg overflow-x-auto">
        {/* Beat markers */}
        <div className="flex border-b border-slate-700" style={{ width: `${totalBeats * BEAT_WIDTH + 32}px` }}>
          <div className="w-8 flex-shrink-0"></div>
          {Array.from({ length: totalBeats }).map((_, i) => (
            <div
              key={i}
              className="text-slate-400 text-xs text-center border-r border-slate-700/50 flex-shrink-0"
              style={{ width: BEAT_WIDTH }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Tracks */}
        {Array.from({ length: trackCount }).map((_, trackIndex) => (
          <div
            key={trackIndex}
            className={`relative h-20 border-b border-slate-700 transition-colors ${
              dragOverTrack === trackIndex ? 'bg-purple-900/30' : 'hover:bg-slate-800/30'
            }`}
            onDragOver={(e) => handleTrackDragOver(e, trackIndex)}
            onDrop={(e) => handleTrackDrop(e, trackIndex)}
            onDragLeave={handleTrackDragLeave}
            style={{ width: `${totalBeats * BEAT_WIDTH + 32}px` }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold border-r border-slate-700 z-10">
              {trackIndex + 1}
            </div>
            <div className="ml-8 relative h-full" style={{ width: `${totalBeats * BEAT_WIDTH}px` }}>
              {/* Beat grid */}
              {Array.from({ length: totalBeats }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-slate-700/30"
                  style={{ left: beatsToPixels(i), width: '1px' }}
                />
              ))}

              {/* Clips */}
              {timeline
                .filter((clip) => clip.track === trackIndex)
                .map((clip) => {
                  const pattern = patterns.find((p) => p.id === clip.patternId);
                  if (!pattern) return null;

                  const widthInBeats = (pattern.length * bpm) / 60;
                  const widthInPixels = Math.max(beatsToPixels(widthInBeats), 40); // Minimum 40px
                  
                  console.log('Rendering clip:', {
                    pattern: pattern.name,
                    lengthSeconds: pattern.length,
                    widthInBeats,
                    widthInPixels,
                    bpm,
                  });
                  
                  return (
                    <div
                      key={clip.id}
                      draggable
                      onDragStart={(e) => handleClipDragStart(e, clip)}
                      onDragEnd={() => setDraggedClip(null)}
                      className="absolute top-1 bottom-1 rounded cursor-move flex items-center justify-between px-2 text-white text-xs font-semibold shadow-lg group hover:shadow-xl hover:scale-[1.02] transition-all"
                      style={{
                        left: beatsToPixels(clip.startTime),
                        width: widthInPixels,
                        backgroundColor: pattern.color,
                        minWidth: '40px',
                      }}
                    >
                      <span className="truncate">{pattern.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeClip(clip.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2 px-1 bg-black/30 rounded hover:bg-black/50 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        {/* Playback cursor */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10"
            style={{
              left: beatsToPixels(playbackPosition) + 32, // +32 for track label width
            }}
          />
        )}
      </div>
    </div>
  );
}

