import React, { useEffect, useMemo, useState } from 'react';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { useAppStore } from '../../store/useAppStore';
import { getAllPresets, ArtistPreset } from '../../presets/artistPresets';
import { generateChord } from '../../music/chords';

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

  const keyMappings = useMemo(
    () => [
      { key: 'W', degree: 1 },
      { key: 'A', degree: 2 },
      { key: 'S', degree: 3 },
      { key: 'D', degree: 4 },
      { key: 'Q', degree: 5 },
      { key: 'E', degree: 6 },
    ],
    [],
  );

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
  }, [joystickPos, audioEngine]);

  const handlePresetNext = () => {
    if (!presets.length) return;
    const nextIndex = (selectedPresetIndex + 1) % presets.length;
    setSelectedPresetIndex(nextIndex);
    applyPreset(presets[nextIndex]);
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

    const state = useAppStore.getState();
    const isRecording = state.sequencer.isRecording;
    const recordingStartTime = state.sequencer.recordingStartTime;

    // Play notes
    chord.forEach((midiNote) => {
      audioEngine.noteOn(midiNote, 0.9);
    });

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
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (uiMode !== 'simple') return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();

    // Prevent auto-repeat: only trigger once while key is held
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

    if (key === ' ') {
      e.preventDefault();
      pressedKeysRef.current.add(key);
      startDegree(1); // Space: tonic
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

    if (key === ' ') {
      stopDegree(1);
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
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        {/* Left: Big chord buttons */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          {keyMappings.map(({ key, degree }) => (
            <button
              key={key}
              onMouseDown={() => startDegree(degree)}
              onMouseUp={() => stopDegree(degree)}
              onMouseLeave={() => stopDegree(degree)}
              className="h-20 md:h-24 rounded-xl bg-slate-700 hover:bg-slate-600 text-base md:text-lg font-bold text-slate-100 transition-all shadow-md flex items-center justify-center select-none"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Right: Joystick */}
        <div className="flex items-center justify-center md:w-48">
          <div
            className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-slate-900/80 border border-slate-700 shadow-inner cursor-pointer select-none"
            ref={joystickRef}
            onMouseDown={handleJoystickMouseDown}
          >
            <div className="absolute inset-3 rounded-full border border-slate-700/60" />
            <div
              className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg border border-white/30"
              style={{
                left: `calc(50% + ${joystickPos.x * 40}px - 1rem)`,
                top: `calc(50% + ${joystickPos.y * 40}px - 1rem)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 flex flex-col gap-1">
        <span>Keys W A S D Q E: trigger chords</span>
        <span>Space: trigger tonic chord (W)</span>
        <span>Drag the circle: joystick (detune + reverb)</span>
        <span>Click preset badge: next artist preset</span>
      </div>
    </div>
  );
}
