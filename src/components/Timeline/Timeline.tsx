import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Pattern, TimelineClip, RecordedNote, RecordedAutomationEvent } from '../../store/useAppStore';
import { exportArrangementAsJSON, importArrangementFromJSON, exportPatternAsJSON, downloadTextFile } from '../../utils/exportUtils';
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
  const [timelineVolume, setTimelineVolume] = useState(0.7); // 70% volume for timeline
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [exportFormat, setExportFormat] = useState<'wav' | 'webm'>('wav');
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

  // Update timeline volume when it changes
  useEffect(() => {
    if (audioEngine) {
      audioEngine.setTimelineVolume(timelineVolume);
      audioEngine.setLiveVolume(0.7); // Keep live at 70% for now
    }
  }, [timelineVolume, audioEngine]);

  // Playback engine (handles timeline clips)
  useEffect(() => {
    if (!isPlaying || !audioEngine) return;

    // Calculate the EXACT end point of the rightmost clip using pattern.length (in seconds)
    let loopEndTime = 0; // in seconds
    timeline.forEach((clip) => {
      const pattern = patterns.find((p) => p.id === clip.patternId);
      if (pattern) {
        // pattern.length is already in seconds from the recording
        const clipStartSeconds = (clip.startTime * 60) / bpm;
        const clipEndSeconds = clipStartSeconds + pattern.length;
        loopEndTime = Math.max(loopEndTime, clipEndSeconds);
      }
    });
    
    // Convert to beats for compatibility with existing logic
    const loopEndBeat = loopEndTime > 0 ? (loopEndTime * bpm) / 60 : totalBeats;

    console.log('Starting playback with', timeline.length, 'clips', 
                isLooping ? `(looping at ${loopEndTime.toFixed(2)}s / ${loopEndBeat.toFixed(2)} beats)` : '(one-shot)',
                `loop duration: ${loopEndTime.toFixed(2)}s`);
    
    const startTime = performance.now();
    const beatDuration = (60 / bpm) * 1000; // ms per beat
    const loopDurationMs = loopEndTime * 1000; // Convert loop duration to milliseconds
    const scheduledNotes = new Set<string>(); // Track already scheduled notes
    playbackRef.current.hasLooped = false;

    const playbackInterval = setInterval(() => {
      const elapsedMs = performance.now() - startTime;
      
      // For looping: use modulo to seamlessly loop without stopping
      const effectiveElapsedMs = isLooping && loopDurationMs > 0 
        ? elapsedMs % loopDurationMs 
        : elapsedMs;
      
      const elapsedBeats = effectiveElapsedMs / beatDuration;
      
      // Check if we've reached the end and should stop (non-looping mode)
      if (!isLooping && elapsedMs >= loopDurationMs) {
        console.log(`🛑 Timeline reached end at ${loopEndTime.toFixed(2)}s (non-looping mode)`);
        stopPlayback();
        return;
      }
      
      // Detect loop restart (seamless - no stop/start needed)
      if (isLooping && loopDurationMs > 0 && Math.floor(elapsedMs / loopDurationMs) > Math.floor(playbackRef.current.lastTime / loopDurationMs)) {
        console.log('🔁 Seamless loop restart at', (elapsedMs / 1000).toFixed(2), 's');
        
        // FORCE stop all possible timeline notes to prevent lingering
        for (let midiNote = 0; midiNote < 128; midiNote++) {
          audioEngine.timelineNoteOff(midiNote);
        }
        
        // Clear all tracking for fresh loop
        scheduledNotes.clear();
        playbackRef.current.activeClips.clear();
        playbackRef.current.timelineNotes.clear();
        playbackRef.current.currentParametersClipId = null;
        playbackRef.current.activeClipsWithParams.clear();
      }
      
      const currentBeat = elapsedBeats;
      playbackRef.current.lastTime = elapsedMs;
      
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
        
        // Check if clip is playing (handle loop wrap-around)
        const isClipPlaying = currentBeat >= clipStartBeat && currentBeat < clipEndBeat;

        if (isClipPlaying) {
          // Calculate relative time within the clip
          const relativeTimeMs = (currentBeat - clipStartBeat) * beatDuration;
          
          // Initialize clip tracking if not exists
          if (!playbackRef.current.activeClips.has(clip.id)) {
            playbackRef.current.activeClips.set(clip.id, new Set());
            
            // Apply captured parameters ONLY to timeline engine (not live!)
            if (pattern.capturedParameters && playbackRef.current.currentParametersClipId !== clip.id) {
              const params = pattern.capturedParameters;
              console.log(`🎨 Applying captured parameters to TIMELINE ENGINE ONLY for clip: ${clip.id}`);
              
              // Convert waveform string to number
              const waveformMap: Record<string, number> = {
                sine: 0, sawtooth: 1, square: 2, triangle: 3, fm: 4, piano: 5,
              };
              
              // Apply to TIMELINE engine only - DO NOT touch live engine
              if (audioEngine.wasmEngine) {
                const wasm = audioEngine.wasmEngine;
                wasm.set_timeline_waveform(waveformMap[params.waveform]);
                wasm.set_timeline_adsr(params.adsr.attack, params.adsr.decay, params.adsr.sustain, params.adsr.release);
                wasm.set_timeline_lfo_rate(params.lfo.rate);
                wasm.set_timeline_lfo_depth(params.lfo.depth);
                wasm.set_timeline_lfo_waveform(params.lfo.waveform);
                wasm.set_timeline_detune(params.detune);
                
                // Effects - timeline only
                wasm.set_timeline_glide_time(params.effects.glide.enabled ? params.effects.glide.time : 0);
                wasm.set_timeline_tremolo(params.effects.tremolo.enabled, params.effects.tremolo.rate, params.effects.tremolo.depth);
                wasm.set_timeline_flanger(params.effects.flanger.enabled, params.effects.flanger.rate, params.effects.flanger.depth, params.effects.flanger.feedback, params.effects.flanger.mix);
                wasm.set_timeline_delay(params.effects.delay.enabled, params.effects.delay.time, params.effects.delay.feedback, params.effects.delay.mix);
                wasm.set_timeline_reverb(params.effects.reverb.enabled, params.effects.reverb.size, params.effects.reverb.damping);
              }
              
              playbackRef.current.currentParametersClipId = clip.id;
              playbackRef.current.activeClipsWithParams.add(clip.id);
            }
          }
          
          // Apply recorded automation (preset changes, joystick moves) for this pattern/clip
          if (pattern.automationEvents && pattern.automationEvents.length > 0) {
            const wasm = audioEngine.wasmEngine;

            if (wasm) {
              pattern.automationEvents.forEach((event: RecordedAutomationEvent, index: number) => {
                const eventKey = `${clip.id}-auto-${event.time}-${event.type}-${index}`;
                const timeDiff = Math.abs(relativeTimeMs - event.time);

                // 30ms tolerance window, same idea as notes
                if (timeDiff < 30 && !scheduledNotes.has(eventKey)) {
                  scheduledNotes.add(eventKey);

                  if (event.type === 'presetChange') {
                    const data = event.data || {};
                    // Try to find the artist preset by identity; fall back to index if available
                    const preset =
                      artistPresets.find(
                        (p) =>
                          p.artist === data.artist &&
                          p.genre === data.genre &&
                          p.name === data.name,
                      ) ||
                      (typeof data.presetIndex === 'number'
                        ? artistPresets[data.presetIndex] || null
                        : null);

                    if (preset) {
                      const waveformMap: Record<string, number> = {
                        sine: 0,
                        sawtooth: 1,
                        square: 2,
                        triangle: 3,
                        fm: 4,
                        piano: 5,
                      };

                      // Apply full preset to TIMELINE engine only
                      wasm.set_timeline_waveform(waveformMap[preset.waveform]);
                      wasm.set_timeline_adsr(
                        preset.adsr.attack,
                        preset.adsr.decay,
                        preset.adsr.sustain,
                        preset.adsr.release,
                      );
                      wasm.set_timeline_lfo_rate(preset.lfo.rate);
                      wasm.set_timeline_lfo_depth(preset.lfo.depth);
                      wasm.set_timeline_lfo_waveform(preset.lfo.waveform);
                      wasm.set_timeline_detune(preset.detune);

                      // Effects
                      const fx = preset.effects;
                      wasm.set_timeline_glide_time(fx.glide.enabled ? fx.glide.time : 0);
                      wasm.set_timeline_tremolo(
                        fx.tremolo.enabled,
                        fx.tremolo.rate,
                        fx.tremolo.depth,
                      );
                      wasm.set_timeline_flanger(
                        fx.flanger.enabled,
                        fx.flanger.rate,
                        fx.flanger.depth,
                        fx.flanger.feedback,
                        fx.flanger.mix,
                      );
                      wasm.set_timeline_delay(
                        fx.delay.enabled,
                        fx.delay.time,
                        fx.delay.feedback,
                        fx.delay.mix,
                      );
                      wasm.set_timeline_reverb(
                        fx.reverb.enabled,
                        fx.reverb.size,
                        fx.reverb.damping,
                      );
                    }
                  } else if (event.type === 'joystickMove') {
                    const data = event.data || {};
                    const x = typeof data.x === 'number' ? data.x : 0;
                    const y = typeof data.y === 'number' ? data.y : 0;

                    // Mirror the Simple Mode joystick behavior but for TIMELINE engine only
                    const state = useAppStore.getState();

                    const newDetune = x * 50; // -50..50 cents
                    const baseReverbMix = state.effects.reverb.mix;
                    const newReverbMix = Math.max(0, Math.min(1, 0.5 - y * 0.5));

                    wasm.set_timeline_detune(newDetune);

                    if (state.effects.reverb.enabled) {
                      wasm.set_timeline_reverb(
                        true,
                        state.effects.reverb.size,
                        newReverbMix,
                      );
                    }

                    const delayEnabled = state.effects.delay.enabled;
                    const baseDelayTime = state.effects.delay.time;
                    const baseDelayMix = state.effects.delay.mix;

                    if (delayEnabled) {
                      const delayTime = Math.max(0.05, baseDelayTime + y * 0.25);
                      const delayMix = Math.max(
                        0,
                        Math.min(1, baseDelayMix + y * 0.3),
                      );
                      wasm.set_timeline_delay(
                        true,
                        delayTime,
                        state.effects.delay.feedback,
                        delayMix,
                      );
                    }

                    const flangerEnabled = state.effects.flanger.enabled;
                    if (flangerEnabled) {
                      const baseDepth = state.effects.flanger.depth;
                      const baseMix = state.effects.flanger.mix;
                      const depth = Math.max(0, baseDepth + x * 5);
                      const mix = Math.max(
                        0,
                        Math.min(1, baseMix + x * 0.3),
                      );

                      wasm.set_timeline_flanger(
                        true,
                        state.effects.flanger.rate,
                        depth,
                        state.effects.flanger.feedback,
                        mix,
                      );
                    }
                  }
                }
              });
            }
          }

          // Note playback for this pattern/clip
          pattern.notes.forEach((note) => {
            const noteKey = `${clip.id}-${note.time}-${note.midiNote}-${note.type}`;
            const timeDiff = Math.abs(relativeTimeMs - note.time);
            
            // 30ms tolerance window - tight enough to be accurate, loose enough to handle timing jitter
            if (timeDiff < 30 && !scheduledNotes.has(noteKey)) {
              scheduledNotes.add(noteKey);
              
              if (note.type === 'noteOn') {
                // If note is already playing, stop it first to avoid voice conflicts
                if (playbackRef.current.timelineNotes.has(note.midiNote)) {
                  audioEngine.timelineNoteOff(note.midiNote);
                }
                
                audioEngine.timelineNoteOn(note.midiNote, note.velocity);
                playbackRef.current.activeClips.get(clip.id)?.add(note.midiNote);
                playbackRef.current.timelineNotes.set(note.midiNote, note.midiNote);
              } else if (note.type === 'noteOff') {
                audioEngine.timelineNoteOff(note.midiNote);
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
              audioEngine.timelineNoteOff(midiNote);
              playbackRef.current.timelineNotes.delete(midiNote);
            });
            activeNotes.clear();
          }
          playbackRef.current.activeClips.delete(clip.id);
          playbackRef.current.activeClipsWithParams.delete(clip.id);
          playbackRef.current.currentParametersClipId = null;
          
          // NOTE: We do NOT restore global parameters because timeline and live engines are separate!
          // Timeline engine has its own parameters, live engine is never affected
        }
      });

      if (scheduledNotes.size > 1000) {
        scheduledNotes.clear();
      }
    }, 10);

    return () => {
      clearInterval(playbackInterval);
      
      // FORCE stop all possible timeline notes (0-127 MIDI range)
      // This ensures no notes are left playing, even if tracking failed
      for (let midiNote = 0; midiNote < 128; midiNote++) {
        audioEngine.timelineNoteOff(midiNote);
      }
      
      // Clear all tracking
      playbackRef.current.timelineNotes.clear();
      playbackRef.current.activeClips.clear();
      playbackRef.current.currentParametersClipId = null;
      playbackRef.current.activeClipsWithParams.clear();
      console.log('🛑 Playback stopped, all timeline notes forcefully stopped (0-127)');
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

  const handleExportArrangementJSON = () => {
    const state = useAppStore.getState();
    const json = exportArrangementAsJSON(state);
    downloadTextFile(json, `webchord-arrangement-${Date.now()}.json`, 'application/json');
  };

  const handleImportArrangementJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const imported = importArrangementFromJSON(json);
          if (!imported) {
            alert('❌ Invalid arrangement file');
            return;
          }

          useAppStore.setState((state) => ({
            ...state,
            audio: {
              ...state.audio,
              bpm: imported.meta?.bpm ?? state.audio.bpm,
            },
            music: {
              ...state.music,
              key: (imported.meta?.key as any) ?? state.music.key,
              mode: (imported.meta?.mode as any) ?? state.music.mode,
            },
            sequencer: {
              ...state.sequencer,
              patterns: imported.patterns,
              timeline: imported.timeline,
            },
          }));

          alert('✅ Arrangement imported!');
        } catch (error) {
          console.error('Failed to import arrangement:', error);
          alert('❌ Failed to import arrangement');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportAudioPrototype = async () => {
    if (!audioEngine) {
      return;
    }

    if (isExportingAudio) {
      return;
    }

    try {
      setIsExportingAudio(true);

      const state = useAppStore.getState();
      const patternsState = state.sequencer.patterns;
      const timelineState = state.sequencer.timeline;
      const bpmState = state.audio.bpm;

      if (!patternsState.length || !timelineState.length) {
        return;
      }

      // Delegar a exportação totalmente para o engine, sem mexer em isPlaying/playbackPosition
      let blob: Blob;
      if (exportFormat === 'webm' && (audioEngine as any).exportArrangementSilentlyToWebm) {
        blob = await (audioEngine as any).exportArrangementSilentlyToWebm(
          patternsState,
          timelineState,
          bpmState,
        );
      } else {
        blob = await (audioEngine as any).exportArrangementSilentlyToWav(
          patternsState,
          timelineState,
          bpmState,
        );
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        exportFormat === 'webm'
          ? `webchord_${Date.now()}.webm`
          : `webchord_${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Audio export failed:', error);
    } finally {
      setIsExportingAudio(false);
    }
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
    <div className="relative bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700">
      {isExportingAudio && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-wait">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-100 font-semibold mb-1">Exporting audio...</p>
          <p className="text-slate-300 text-xs">This may take a few seconds. Please wait.</p>
        </div>
      )}
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
          <button
            onClick={handleExportArrangementJSON}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all"
            title="Export current arrangement (patterns + timeline) as JSON"
          >
            📤 Export JSON
          </button>
          <button
            onClick={handleImportArrangementJSON}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-semibold transition-all"
            title="Import arrangement (patterns + timeline) from JSON file"
          >
            📥 Import JSON
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAudioPrototype}
              className={`px-4 py-2 rounded-lg font-semibold transition-all text-white ${
                isExportingAudio
                  ? 'bg-slate-800 cursor-not-allowed opacity-70'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title="Export current arrangement audio to file"
              disabled={isExportingAudio}
            >
              {isExportingAudio ? '⏳ Exporting...' : '🎧 Export Audio'}
            </button>
            <div className="flex items-center gap-1 text-xs text-slate-300">
              <span className="hidden sm:inline">Format:</span>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'wav' | 'webm')}
                className="px-2 py-1 bg-slate-800 text-slate-100 rounded-md text-xs font-semibold border border-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                title="Choose audio export format for the Export Audio button"
              >
                <option value="wav">WAV</option>
                <option value="webm">WEBM</option>
              </select>
            </div>
          </div>
          
          {/* Timeline Volume Control */}
          <div className="flex items-center gap-2 ml-4 px-3 py-2 bg-slate-700/50 rounded-lg">
            <span className="text-white text-sm font-semibold">🔊 Timeline:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={timelineVolume * 100}
              onChange={(e) => setTimelineVolume(parseInt(e.target.value) / 100)}
              className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider-thumb"
              title="Timeline volume (independent from live performance)"
            />
            <span className="text-slate-300 text-xs font-mono w-8">{Math.round(timelineVolume * 100)}%</span>
          </div>
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const json = exportPatternAsJSON(pattern);
                      downloadTextFile(json, `webchord-pattern-${pattern.id}.json`, 'application/json');
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 px-1.5 py-0.5 bg-black/30 rounded hover:bg-black/50 transition-opacity text-xs"
                    title="Export pattern as JSON"
                    draggable={false}
                  >
                    ⬇
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!audioEngine || !audioEngine.renderPatternOfflineToWav) {
                        alert('❌ Offline audio export not available');
                        return;
                      }
                      try {
                        const blob = await audioEngine.renderPatternOfflineToWav(pattern);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `webchord-pattern-${pattern.id}.wav`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Pattern offline export failed:', error);
                        alert('❌ Failed to export pattern audio');
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-1 px-1.5 py-0.5 bg-black/30 rounded hover:bg-black/50 transition-opacity text-xs"
                    title="Export pattern as WAV (offline render)"
                    draggable={false}
                  >
                    🎧
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

