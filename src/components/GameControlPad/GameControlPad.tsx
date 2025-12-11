import React, { useEffect, useMemo, useState } from 'react';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { useAppStore } from '../../store/useAppStore';
import { getAllPresets, ArtistPreset } from '../../presets/artistPresets';
import { generateChord, getChordName } from '../../music/chords';

interface GameControlPadProps {
  audioEngine: WasmAudioEngine | null;
}

interface JoystickPos {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export default function GameControlPad({ audioEngine }: GameControlPadProps) {
  const key = useAppStore((state) => state.music.key);
  const globalOctave = useAppStore((state) => state.music.globalOctave);
  const uiMode = useAppStore((state) => state.ui.mode);

  const [joystickPos, setJoystickPos] = useState<JoystickPos>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [activeDegrees, setActiveDegrees] = useState<Set<number>>(new Set());

  const keyMappings = useMemo(
    () => [
      { key: 'Q', degree: 1 },
      { key: 'W', degree: 2 },
      { key: 'E', degree: 3 },
      { key: 'A', degree: 4 },
      { key: 'S', degree: 5 },
      { key: 'D', degree: 6 },
      { key: 'F', degree: 7 },
    ],
    [],
  );

  const PAD_COLORS: Record<number, string> = {
    1: 'from-green-500 to-green-600 ring-green-400 shadow-green-500/40',
    2: 'from-blue-500 to-blue-600 ring-blue-400 shadow-blue-500/40',
    3: 'from-pink-500 to-pink-600 ring-pink-400 shadow-pink-500/40',
    4: 'from-amber-500 to-amber-600 ring-amber-400 shadow-amber-500/40',
    5: 'from-emerald-500 to-emerald-600 ring-emerald-400 shadow-emerald-500/40',
    6: 'from-purple-500 to-purple-600 ring-purple-400 shadow-purple-500/40',
    7: 'from-red-500 to-red-600 ring-red-400 shadow-red-500/40',
  };

  const pressedKeysRef = React.useRef<Set<string>>(new Set());
  const activeChordNotesRef = React.useRef<Map<number, number[]>>(new Map());
  const joystickRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingRef = React.useRef(false);

  const presets = useMemo(() => getAllPresets(), []);
  const currentPreset: ArtistPreset | null = presets.length
    ? presets[Math.max(0, Math.min(selectedPresetIndex, presets.length - 1))]
    : null;

  // Apply joystick to detune + flanger on X, and reverb + delay on Y
  useEffect(() => {
    if (!audioEngine) return;

    const newDetune = joystickPos.x * 50; // -50..50 cents
    const newReverbMix = Math.max(0, Math.min(1, 0.5 - joystickPos.y * 0.5));

    useAppStore.setState((state) => ({
      synthesis: {
        ...state.synthesis,
        detune: newDetune,
      },
      effects: {
        ...state.effects,
        reverb: {
          ...state.effects.reverb,
          mix: newReverbMix,
        },
      },
    }));

    audioEngine.setDetune(newDetune);

    const st = useAppStore.getState();

    // Y-axis: reverb + delay
    if (st.effects.reverb.enabled) {
      audioEngine.setReverb(true, st.effects.reverb.size, newReverbMix);
    }

    const delayEnabled = st.effects.delay.enabled;
    const baseDelayTime = st.effects.delay.time;      // seconds
    const baseDelayMix = st.effects.delay.mix;

    if (delayEnabled) {
      const delayTime = Math.max(0.05, baseDelayTime + joystickPos.y * 0.25); // +/- 250ms
      const delayMix = Math.max(0, Math.min(1, baseDelayMix + joystickPos.y * 0.3));
      audioEngine.setDelay(true, delayTime, st.effects.delay.feedback, delayMix);

      useAppStore.setState((state) => ({
        effects: {
          ...state.effects,
          delay: {
            ...state.effects.delay,
            time: delayTime,
            mix: delayMix,
          },
        },
      }));
    }

    // X-axis: flanger + detune already applied via newDetune
    const flangerEnabled = st.effects.flanger.enabled;
    if (flangerEnabled) {
      const baseDepth = st.effects.flanger.depth;
      const baseMix = st.effects.flanger.mix;
      const depth = Math.max(0, baseDepth + joystickPos.x * 5); // +/- 5 ms
      const mix = Math.max(0, Math.min(1, baseMix + joystickPos.x * 0.3));

      audioEngine.setFlanger(true, st.effects.flanger.rate, depth, st.effects.flanger.feedback, mix);

      useAppStore.setState((state) => ({
        effects: {
          ...state.effects,
          flanger: {
            ...state.effects.flanger,
            depth,
            mix,
          },
        },
      }));
    }

    // If we're recording, log this joystick move as an automation event relative to recordingStartTime
    const seqState = useAppStore.getState().sequencer;
    if (seqState.isRecording) {
      const now = performance.now();
      const recordingStartTime = seqState.recordingStartTime || now;

      // If this is the first event (recordingStartTime === 0), initialize it now
      if (seqState.recordingStartTime === 0) {
        useAppStore.setState((state) => ({
          sequencer: {
            ...state.sequencer,
            recordingStartTime: now,
          },
        }));
      }

      const relativeTime = now - recordingStartTime;

      useAppStore.setState((state) => ({
        sequencer: {
          ...state.sequencer,
          automationEvents: [
            ...state.sequencer.automationEvents,
            {
              time: relativeTime,
              type: 'joystickMove',
              data: {
                x: joystickPos.x,
                y: joystickPos.y,
              },
            },
          ],
        },
      }));
    }
  }, [joystickPos, audioEngine]);

  const handlePresetNext = () => {
    if (!presets.length) return;

    setSelectedPresetIndex((prevIndex) => {
      const nextIndex = (prevIndex + 1) % presets.length;
      const nextPreset = presets[nextIndex];

      // Apply the preset immediately
      applyPreset(nextPreset);

      // If recording, log this preset change as an automation event
      const seqState = useAppStore.getState().sequencer;
      if (seqState.isRecording) {
        const now = performance.now();
        const recordingStartTime = seqState.recordingStartTime || now;

        if (seqState.recordingStartTime === 0) {
          useAppStore.setState((state) => ({
            sequencer: {
              ...state.sequencer,
              recordingStartTime: now,
            },
          }));
        }

        const relativeTime = now - recordingStartTime;

        useAppStore.setState((state) => ({
          sequencer: {
            ...state.sequencer,
            automationEvents: [
              ...state.sequencer.automationEvents,
              {
                time: relativeTime,
                type: 'presetChange',
                data: {
                  presetIndex: nextIndex,
                  artist: nextPreset.artist,
                  genre: nextPreset.genre,
                  name: nextPreset.name,
                },
              },
            ],
          },
        }));
      }

      return nextIndex;
    });
  };

  const applyPreset = (preset: ArtistPreset) => {
    if (!audioEngine) return;

    audioEngine.stopAllNotes();

    setTimeout(() => {
      useAppStore.setState((state) => ({
        audio: {
          ...state.audio,
          bpm: preset.bpm,
          masterVolume: preset.masterVolume,
        },
        music: {
          ...state.music,
          key: preset.key as any,
          globalOctave: preset.globalOctave,
        },
        synthesis: {
          ...state.synthesis,
          waveform: preset.waveform,
          adsr: preset.adsr,
          lfo: preset.lfo,
          detune: preset.detune,
        },
        effects: {
          ...state.effects,
          ...preset.effects,
        },
      }));

      audioEngine.setMasterVolume(preset.masterVolume);

      const waveformMap: Record<string, number> = {
        sine: 0,
        sawtooth: 1,
        square: 2,
        triangle: 3,
        fm: 4,
        piano: 5,
      };

      audioEngine.setWaveform(waveformMap[preset.waveform]);
      audioEngine.setADSR(
        preset.adsr.attack,
        preset.adsr.decay,
        preset.adsr.sustain,
        preset.adsr.release,
      );
      audioEngine.setLFORate(preset.lfo.rate);
      audioEngine.setLFODepth(preset.lfo.depth);
      audioEngine.setLFOWaveform(preset.lfo.waveform);
      audioEngine.setDetune(preset.detune);

      audioEngine.setGlideTime(preset.effects.glide.enabled ? preset.effects.glide.time : 0);
      audioEngine.setTremolo(
        preset.effects.tremolo.enabled,
        preset.effects.tremolo.rate,
        preset.effects.tremolo.depth,
      );
      audioEngine.setFlanger(
        preset.effects.flanger.enabled,
        preset.effects.flanger.rate,
        preset.effects.flanger.depth,
        preset.effects.flanger.feedback,
        preset.effects.flanger.mix,
      );
      audioEngine.setDelay(
        preset.effects.delay.enabled,
        preset.effects.delay.time,
        preset.effects.delay.feedback,
        preset.effects.delay.mix,
      );
      audioEngine.setReverb(
        preset.effects.reverb.enabled,
        preset.effects.reverb.size,
        preset.effects.reverb.damping,
      );
    }, 10);
  };

  // Mini chord triggering (I–VI degrees) with recording support
  const startDegree = (degree: number) => {
    if (!audioEngine) return;

    const pressTime = performance.now();
    const chord = generateChord(key, degree as any, undefined, 0, globalOctave);
    activeChordNotesRef.current.set(degree, chord);

    // Update visual active state for pad buttons
    setActiveDegrees((prev) => {
      const next = new Set(prev);
      next.add(degree);
      return next;
    });

    const state = useAppStore.getState();
    const isRecording = state.sequencer.isRecording;
    const recordingStartTime = state.sequencer.recordingStartTime;

    // Play notes
    chord.forEach((midiNote) => {
      audioEngine.noteOn(midiNote, 0.9);
    });

    // Dispatch chord played event for suggestion/visual systems
    window.dispatchEvent(
      new CustomEvent('chordPlayed', {
        detail: { degree, timestamp: pressTime },
      }),
    );

    if (isRecording) {
      const isFirstEvent = recordingStartTime === 0;

      if (isFirstEvent) {
        // Initialize recording starting at this moment
        useAppStore.setState((s) => ({
          sequencer: {
            ...s.sequencer,
            recordingStartTime: pressTime,
            recordedNotes: chord.map((midiNote) => ({
              time: 0,
              type: 'noteOn' as const,
              midiNote,
              velocity: 0.9,
              degree,
            })),
          },
        }));
      } else {
        const relativeTime = pressTime - recordingStartTime;
        useAppStore.setState((s) => ({
          sequencer: {
            ...s.sequencer,
            recordedNotes: [
              ...s.sequencer.recordedNotes,
              ...chord.map((midiNote) => ({
                time: relativeTime,
                type: 'noteOn' as const,
                midiNote,
                velocity: 0.9,
                degree,
              })),
            ],
          },
        }));
      }
    }
  };

  const stopDegree = (degree: number) => {
    if (!audioEngine) return;

    const chord = activeChordNotesRef.current.get(degree);
    if (!chord) return;

    const releaseTime = performance.now();
    const state = useAppStore.getState();
    const isRecording = state.sequencer.isRecording;
    const recordingStartTime = state.sequencer.recordingStartTime;

    chord.forEach((midiNote) => {
      audioEngine.noteOff(midiNote, false);
    });

    if (isRecording && recordingStartTime > 0) {
      const relativeTime = releaseTime - recordingStartTime;
      useAppStore.setState((s) => ({
        sequencer: {
          ...s.sequencer,
          recordedNotes: [
            ...s.sequencer.recordedNotes,
            ...chord.map((midiNote) => ({
              time: relativeTime,
              type: 'noteOff' as const,
              midiNote,
              velocity: 0,
              degree,
            })),
          ],
        },
      }));
    }

    activeChordNotesRef.current.delete(degree);

    // Clear visual active state for pad buttons
    setActiveDegrees((prev) => {
      const next = new Set(prev);
      next.delete(degree);
      return next;
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (uiMode !== 'simple') return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const rawKey = e.key;
    const key = rawKey.toLowerCase();

    // Treat both modern (' ') and legacy ('Spacebar') values as Space based on key *or* code
    if (rawKey === ' ' || rawKey === 'Spacebar' || e.code === 'Space') {
      e.preventDefault();
      handlePresetNext();
      return;
    }

    // Prevent auto-repeat for chord keys: only trigger once while key is held
    if (pressedKeysRef.current.has(key)) {
      return;
    }

    const mapping = keyMappings.find((m) => m.key.toLowerCase() === key);
    if (mapping) {
      e.preventDefault();
      pressedKeysRef.current.add(key);
      startDegree(mapping.degree);
      return;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (uiMode !== 'simple') return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();
    pressedKeysRef.current.delete(key);

    const mapping = keyMappings.find((m) => m.key.toLowerCase() === key);
    if (mapping) {
      stopDegree(mapping.degree);
      return;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      pressedKeysRef.current.clear();
    };
  }, [uiMode, keyMappings]);

  const updateJoystickFromClient = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (clientY - cy) / (rect.height / 2);

    const clampedX = Math.max(-1, Math.min(1, dx));
    const clampedY = Math.max(-1, Math.min(1, dy));

    setJoystickPos({ x: clampedX, y: clampedY });
  };

  const handleJoystickMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    updateJoystickFromClient(e.clientX, e.clientY);

    const handleMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      updateJoystickFromClient(ev.clientX, ev.clientY);
    };

    const handleUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-purple-600/60 shadow-2xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <div className="flex flex-col">
            <span className="text-white text-sm font-semibold">Explorer Pad</span>
            <span className="text-slate-400 text-xs">HiChord-style performance</span>
          </div>
        </div>

        <button
          onClick={handlePresetNext}
          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white transition-all shadow-md"
          title="Click to change artist preset"
        >
          {currentPreset ? `${currentPreset.artist} (${currentPreset.genre})` : 'No presets'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left: Big chord buttons - 3 columns */}
        <div className="md:col-span-3 grid grid-cols-3 gap-2 justify-items-center">
          {keyMappings.slice(0, 6).map(({ key: keyboardKey, degree }) => {
            const isActive = activeDegrees.has(degree);
            const chordLabel = getChordName(key as any, degree)
              .replace('Major', 'maj')
              .replace('Minor', 'min')
              .replace('Dim', 'dim');

            return (
              <button
                key={keyboardKey}
                onMouseDown={() => startDegree(degree)}
                onMouseUp={() => stopDegree(degree)}
                onMouseLeave={() => stopDegree(degree)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDegree(degree);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDegree(degree);
                }}
                className={`h-24 md:h-28 rounded-xl text-base md:text-lg font-bold transition-all shadow-lg flex items-center justify-center select-none touch-none w-full
                  ${isActive
                    ? `bg-gradient-to-br text-white scale-[1.02] ring-2 ${PAD_COLORS[degree]}`
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  }
                `}
              >
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span>{chordLabel}</span>
                  <span className="text-[10px] text-slate-200/70 mt-1">[{keyboardKey}]</span>
                </div>
              </button>
            );
          })}
          {/* Empty placeholders to center the last button */}
          <div className="invisible" />
          {(() => {
            const lastMapping = keyMappings[6];
            const isActive = activeDegrees.has(lastMapping.degree);
            const chordLabel = getChordName(key as any, lastMapping.degree)
              .replace('Major', 'maj')
              .replace('Minor', 'min')
              .replace('Dim', 'dim');

            return (
              <button
                key={lastMapping.key}
                onMouseDown={() => startDegree(lastMapping.degree)}
                onMouseUp={() => stopDegree(lastMapping.degree)}
                onMouseLeave={() => stopDegree(lastMapping.degree)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  startDegree(lastMapping.degree);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopDegree(lastMapping.degree);
                }}
                className={`h-24 md:h-28 rounded-xl text-base md:text-lg font-bold transition-all shadow-lg flex items-center justify-center select-none touch-none w-full
                  ${isActive
                    ? `bg-gradient-to-br text-white scale-[1.02] ring-2 ${PAD_COLORS[lastMapping.degree]}`
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  }
                `}
              >
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span>{chordLabel}</span>
                  <span className="text-[10px] text-slate-200/70 mt-1">[{lastMapping.key}]</span>
                </div>
              </button>
            );
          })()}
          <div className="invisible" />
        </div>

        {/* Right: Joystick - spans 2 rows */}
        <div className="flex items-center justify-center md:row-span-2">
          <div
            className="relative w-48 h-48 rounded-full bg-slate-900/80 border border-slate-700 shadow-inner cursor-pointer select-none"
            ref={joystickRef}
            onMouseDown={handleJoystickMouseDown}
          >
            <div className="absolute inset-4 rounded-full border border-slate-700/60" />
            <div
              className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg border border-white/30"
              style={{
                left: `calc(50% + ${joystickPos.x * 60}px - 1.5rem)`,
                top: `calc(50% + ${joystickPos.y * 60}px - 1.5rem)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 flex flex-col gap-1">
        <span>Keys W E R / A S D F: trigger I–VII chords (labels show chord names)</span>
        <span>Space: switch artist preset</span>
        <span>Drag the circle: joystick (detune + reverb)</span>
        <span>Click preset badge: next artist preset</span>
      </div>
    </div>
  );
}
