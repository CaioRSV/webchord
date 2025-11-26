import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { artistPresets, defaultPreset, getAllPresets, ArtistPreset } from '../../presets/artistPresets';

interface ArtistPresetSelectorProps {
  audioEngine: WasmAudioEngine | null;
}

export default function ArtistPresetSelector({ audioEngine }: ArtistPresetSelectorProps) {
  const [selectedPresetId, setSelectedPresetId] = useState('default');
  const [showInfo, setShowInfo] = useState(false);

  const allPresets = getAllPresets();
  const currentPreset = allPresets.find((p) => p.id === selectedPresetId) || defaultPreset;

  const applyPreset = (preset: ArtistPreset) => {
    if (!audioEngine) return;

    // Stop all currently playing notes to prevent stuck notes
    audioEngine.stopAllNotes();
    
    // Small delay to ensure note offs are processed
    setTimeout(() => {
      applyPresetInternal(preset);
    }, 10);
  };

  const applyPresetInternal = (preset: ArtistPreset) => {
    if (!audioEngine) return;

    // Update global state
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
        filter: preset.filter,
        lfo: preset.lfo,
        detune: preset.detune,
      },
      effects: {
        ...state.effects,
        ...preset.effects,
      },
    }));

    // Apply to audio engine
    audioEngine.setMasterVolume(preset.masterVolume);
    
    // Convert waveform string to number
    const waveformMap: Record<string, number> = {
      sine: 0,
      sawtooth: 1,
      square: 2,
      triangle: 3,
      fm: 4,
      piano: 5,
    };
    audioEngine.setWaveform(waveformMap[preset.waveform]);
    
    audioEngine.setADSR(preset.adsr.attack, preset.adsr.decay, preset.adsr.sustain, preset.adsr.release);
    audioEngine.setFilterCutoff(preset.filter.cutoff);
    audioEngine.setFilterResonance(preset.filter.resonance);
    audioEngine.setFilterMode(preset.filter.mode);
    audioEngine.setFilterEnabled(preset.filter.enabled);
    audioEngine.setLFORate(preset.lfo.rate);
    audioEngine.setLFODepth(preset.lfo.depth);
    audioEngine.setLFOWaveform(preset.lfo.waveform);
    audioEngine.setLFOToFilter(preset.lfo.enabled);
    audioEngine.setDetune(preset.detune);
    
    // Effects
    audioEngine.setGlideTime(preset.effects.glide.enabled ? preset.effects.glide.time : 0);
    audioEngine.setTremolo(
      preset.effects.tremolo.enabled,
      preset.effects.tremolo.rate,
      preset.effects.tremolo.depth
    );
    audioEngine.setFlanger(
      preset.effects.flanger.enabled,
      preset.effects.flanger.depth,
      preset.effects.flanger.rate,
      preset.effects.flanger.feedback,
      preset.effects.flanger.mix
    );
    audioEngine.setDelay(
      preset.effects.delay.enabled,
      preset.effects.delay.time,
      preset.effects.delay.feedback,
      preset.effects.delay.mix
    );
    audioEngine.setReverb(
      preset.effects.reverb.enabled,
      preset.effects.reverb.size,
      preset.effects.reverb.damping
    );

    setSelectedPresetId(preset.id);
    console.log(`🎨 Applied preset: ${preset.name}`);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-bold flex items-center gap-2">
          <span className="text-xl">🎨</span> ARTIST PRESETS
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-slate-400 hover:text-white text-xs transition-colors"
        >
          {showInfo ? '✕' : 'ℹ️'}
        </button>
      </div>

      {/* Current Preset Info */}
      {showInfo && (
        <div className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          <p className="text-purple-300 text-xs font-semibold mb-1">{currentPreset.artist}</p>
          <p className="text-slate-300 text-xs mb-1">{currentPreset.description}</p>
          <p className="text-slate-400 text-xs">
            Genre: {currentPreset.genre} | BPM: {currentPreset.bpm}
          </p>
        </div>
      )}

      {/* Preset Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Default Preset */}
        <button
          onClick={() => applyPreset(defaultPreset)}
          className={`p-3 rounded-lg text-left transition-all ${
            selectedPresetId === 'default'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 border-2 border-purple-400 shadow-lg'
              : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700 hover:border-purple-500'
          }`}
        >
          <div className="text-white text-xs font-bold mb-1">Default</div>
          <div className="text-slate-300 text-xs">Clean Synth</div>
        </button>

        {/* Artist Presets */}
        {artistPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={`p-3 rounded-lg text-left transition-all ${
              selectedPresetId === preset.id
                ? 'bg-gradient-to-br from-pink-600 to-purple-600 border-2 border-pink-400 shadow-lg scale-105'
                : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700 hover:border-pink-500'
            }`}
          >
            <div className="text-white text-xs font-bold mb-1 truncate">{preset.artist}</div>
            <div className="text-slate-300 text-xs truncate">{preset.genre}</div>
            <div className="text-slate-400 text-xs mt-1">{preset.bpm} BPM</div>
          </button>
        ))}
      </div>

      {/* Quick Info */}
      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-blue-200 text-xs">
          💡 <strong>Tip:</strong> Each preset instantly configures all synthesis, filter, LFO, and effects parameters to match the artist's signature sound!
        </p>
      </div>
    </div>
  );
}

