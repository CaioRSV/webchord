import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Pattern, TimelineClip, RecordedNote } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { generateChord } from '../../music/chords';
import { generateProceduralProgression, GENERATIVE_PRESETS, GenerationConfig } from '../../utils/proceduralMusicGenerator';
import { getGenerativePresetParameters } from '../../utils/generativePresetParameters';
import { artistPresets } from '../../presets/artistPresets';
import { getArtistGenerativeConfig } from '../../utils/artistToGenerativeMapping';

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
  const [selectedPreset, setSelectedPreset] = useState<string>('Random');
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
        console.log('🔁 Loop detected - clearing state for replay');
        
        // Clear scheduled notes to allow re-triggering
        scheduledNotes.clear();
        
        // Reset clip tracking for parameter reapplication
        playbackRef.current.activeClips.clear();
        playbackRef.current.currentParametersClipId = null;
        playbackRef.current.activeClipsWithParams.clear();
        playbackRef.current.hasLooped = true;
        
        // NOTE: We do NOT clear timelineNotes here or force noteOff all notes
        // The noteOn handler below will check if a note is already playing
        // and stop it before re-triggering, preventing overlap without cutting notes prematurely
        
        console.log('✅ State cleared, notes will be managed by event handlers');
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
                // Safety check: if note is already playing, stop it first
                // This handles edge cases where noteOff might have been missed
                if (playbackRef.current.timelineNotes.has(note.midiNote)) {
                  audioEngine.noteOff(note.midiNote, false);
                }
                
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


  const randomizeSteps = (presetName?: string) => {
    // ===== ADVANCED PROCEDURAL MUSIC GENERATION =====
    // Uses latest 2024/2025 techniques: Tension curves, Density mapping, 
    // Phrase structures, Euclidean rhythms, Voice leading
    
    // Get preset or use random settings
    let config: GenerationConfig | undefined;
    let artistPresetParams = null;
    
    // Check if it's an artist preset first
    if (presetName) {
      const artistConfig = getArtistGenerativeConfig(presetName);
      if (artistConfig) {
        // It's an artist preset!
        config = artistConfig.config;
        console.log(`🎨 Using artist preset: ${presetName} - ${artistConfig.description}`);
        
        // Get the full artist preset for synthesis parameters
        const artistPreset = artistPresets.find(p => p.artist === presetName);
        if (artistPreset) {
          artistPresetParams = artistPreset;
        }
      } else if (GENERATIVE_PRESETS[presetName]) {
        // It's a generative preset
        const preset = GENERATIVE_PRESETS[presetName];
        config = {
          slots: 16,
          density: preset.density || 0.5,
          tensionCurve: preset.tensionCurve || 'arc',
          rhythmicStyle: preset.rhythmicStyle || 'steady',
          phraseStructure: preset.phraseStructure || 'ABAB',
          creativity: preset.creativity || 0.5,
        };
        console.log(`🎭 Using generative preset: ${presetName}`);
      }
    }
    
    if (!config) {
      // Random configuration (fallback if preset not found or no preset specified)
      const densityOptions = [0.25, 0.3, 0.4, 0.5, 0.6, 0.75];
      const tensionOptions: Array<'arc' | 'wave' | 'buildup' | 'release' | 'random'> = ['arc', 'wave', 'buildup', 'release', 'random'];
      const rhythmOptions: Array<'steady' | 'syncopated' | 'euclidean' | 'sparse' | 'random'> = ['steady', 'syncopated', 'euclidean', 'sparse', 'random'];
      const phraseOptions: Array<'AABA' | 'ABAB' | 'ABAC' | 'question-answer' | 'through-composed'> = ['AABA', 'ABAB', 'ABAC', 'question-answer', 'through-composed'];
      
      config = {
        slots: 16,
        density: densityOptions[Math.floor(Math.random() * densityOptions.length)],
        tensionCurve: tensionOptions[Math.floor(Math.random() * tensionOptions.length)],
        rhythmicStyle: rhythmOptions[Math.floor(Math.random() * rhythmOptions.length)],
        phraseStructure: phraseOptions[Math.floor(Math.random() * phraseOptions.length)],
        creativity: Math.random() * 0.6 + 0.2, // 0.2 - 0.8
      };
      console.log('🎲 Using random configuration');
      presetName = undefined; // Clear preset name for random
    }
    
    // Generate progression using advanced algorithm
    const generatedSlots = generateProceduralProgression(config, key);
    
    // Convert to timeline format (16 beats = 16 seconds at 60 BPM = 8 seconds at 120 BPM)
    const secondsPerBeat = 60 / bpm;
    const totalLengthSeconds = 16 * secondsPerBeat;
    const notes: RecordedNote[] = [];
    
    generatedSlots.forEach((slot) => {
      if (slot.degree === null) return; // Skip rests
      
      const startBeat = slot.position;
      let startTime = startBeat * secondsPerBeat * 1000; // Convert to ms
      
      // Apply swing for groove (shift timing slightly)
      const swingAmount = slot.swing * secondsPerBeat * 100; // Convert to ms
      startTime += swingAmount;
      
      // Add micro-timing variations for human feel (±15ms)
      const humanize = (Math.random() - 0.5) * 15;
      const actualStartTime = startTime + humanize;
      
      try {
        const chord = generateChord(key, slot.degree, undefined, 0, globalOctave);
        
        // Variable stagger based on rhythm style for more natural arpeggio
        const baseStagger = 5 + (slot.stagger * 15); // 5-20ms range
        
        // Stagger note-on times for arpeggio effect
        chord.forEach((midiNote, noteIndex) => {
          const noteStagger = noteIndex * baseStagger;
          
          notes.push({
            midiNote,
            velocity: slot.velocity,
            type: 'noteOn' as const,
            time: actualStartTime + noteStagger,
            degree: 0,
          });
        });
        
        // Note off timing with voice leading considerations
        const noteDuration = slot.duration * secondsPerBeat * 1000;
        const durationMultiplier = 0.88 + (slot.stagger * 0.08); // 0.88-0.96 range
        const endTime = actualStartTime + (noteDuration * durationMultiplier);
        
        chord.forEach((midiNote, noteIndex) => {
          // Release in reverse order for smoother voice leading
          const releaseStagger = (chord.length - 1 - noteIndex) * (baseStagger * 0.6);
          
          notes.push({
            midiNote,
            velocity: slot.velocity,
            type: 'noteOff' as const,
            time: endTime + releaseStagger,
            degree: 0,
          });
        });
      } catch (error) {
        console.error('Error generating chord:', error);
      }
    });
    
    // Create pattern name from progression
    const romanNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const chordDegrees = generatedSlots
      .filter(s => s.degree !== null)
      .map(s => romanNumerals[(s.degree as number) - 1]);
    
    const progressionName = presetName 
      ? `${presetName} (${chordDegrees.slice(0, 4).join('-')}...)`
      : `${chordDegrees.slice(0, 4).join('-')} (${config.tensionCurve})`;
    
    // Color selection: use genre-specific color for artist presets
    let patternColor: string;
    if (artistPresetParams) {
      const genreColors: { [key: string]: string } = {
        'Ambient / Lo-fi': '#8b5cf6',
        'Wave / Hardwave': '#ec4899',
        'Lo-fi Hip Hop': '#10b981',
        'Lo-fi / Jazz Hip Hop': '#f59e0b',
        'Jazz Hop / Chillhop': '#3b82f6',
        'Wave / Phonk': '#ef4444',
        'Ambient Lo-fi': '#06b6d4',
        'Chillhop / Ambient': '#84cc16',
        'Chillwave / Electronic': '#a855f7',
      };
      patternColor = genreColors[artistPresetParams.genre] || '#8b5cf6';
    } else {
      const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];
      patternColor = colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Get synthesis parameters: use artist preset if available, otherwise generative preset
    let synthParams;
    if (artistPresetParams) {
      synthParams = {
        waveform: artistPresetParams.waveform,
        adsr: artistPresetParams.adsr,
        filter: artistPresetParams.filter,
        lfo: artistPresetParams.lfo,
        detune: artistPresetParams.detune,
        effects: {
          ...artistPresetParams.effects,
          bass: { enabled: false, level: 0.5 },
          stereo: { mode: 'stereo' as const },
        },
      };
    } else {
      synthParams = getGenerativePresetParameters(presetName);
    }
    
    const newPattern: Pattern = {
      id: `pattern-${Date.now()}`,
      name: progressionName,
      length: totalLengthSeconds,
      notes,
      color: patternColor,
      // Capture synthesis parameters for this pattern
      capturedParameters: {
        waveform: synthParams.waveform,
        adsr: synthParams.adsr,
        filter: synthParams.filter,
        lfo: synthParams.lfo,
        detune: synthParams.detune,
        effects: synthParams.effects,
      },
    };
    
    // Add pattern to patterns list
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        patterns: [...state.sequencer.patterns, newPattern],
      },
    }));
    
    console.log(`✨ Generated: ${progressionName}`);
    console.log(`   • Config: Density=${config.density}, Tension=${config.tensionCurve}, Rhythm=${config.rhythmicStyle}`);
    console.log(`   • Phrase: ${config.phraseStructure}, Creativity=${config.creativity.toFixed(2)}`);
    console.log(`   • Progression: ${chordDegrees.join(' → ')}`);
    console.log(`   • 📚 Added to Pattern Library`);
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
          
          {/* Preset Selector + Generate Button */}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold transition-all shadow-md cursor-pointer border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
              title="Select generation style"
            >
              <option value="Random">🎲 Random</option>
              
              <optgroup label="🎭 Generative Presets">
                <option value="Pop Hit">🎤 Pop Hit</option>
                <option value="Ambient Chill">🌊 Ambient Chill</option>
                <option value="Energetic EDM">⚡ Energetic EDM</option>
                <option value="Jazz Exploration">🎷 Jazz Exploration</option>
                <option value="Minimalist">🎭 Minimalist</option>
                <option value="Epic Buildup">🏔️ Epic Buildup</option>
                <option value="Completely Random">🌀 Completely Random</option>
              </optgroup>
              
              <optgroup label="🎨 Artist Presets">
                {artistPresets.map((preset) => (
                  <option key={preset.id} value={preset.artist}>
                    {preset.artist} ({preset.genre})
                  </option>
                ))}
              </optgroup>
            </select>
            
            <button
              onClick={() => randomizeSteps(selectedPreset === 'Random' ? undefined : selectedPreset)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded text-xs font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105"
              title={`Generate ${selectedPreset} pattern (16 slots with AI)`}
            >
              ✨ Generate
            </button>
          </div>
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

