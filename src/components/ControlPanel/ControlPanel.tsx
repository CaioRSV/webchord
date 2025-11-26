import { useAppStore } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { NOTES } from '../../music/chords';

interface ControlPanelProps {
  audioEngine: WasmAudioEngine | null;
}

export default function ControlPanel({ audioEngine }: ControlPanelProps) {
  const key = useAppStore((state) => state.music.key);
  const globalOctave = useAppStore((state) => state.music.globalOctave);
  const bpm = useAppStore((state) => state.audio.bpm);
  const masterVolume = useAppStore((state) => state.audio.masterVolume);
  const waveform = useAppStore((state) => state.synthesis.waveform);
  const adsr = useAppStore((state) => state.synthesis.adsr);
  const synthesis = useAppStore((state) => state.synthesis);

  const waveformMap: Record<string, number> = {
    sine: 0,
    sawtooth: 1,
    square: 2,
    triangle: 3,
    fm: 4,
    piano: 5,
  };

  const handleKeyChange = (newKey: string) => {
    useAppStore.setState((state) => ({
      music: { ...state.music, key: newKey as any },
    }));
  };

  const handleOctaveChange = (octave: number) => {
    useAppStore.setState((state) => ({
      music: { ...state.music, globalOctave: octave },
    }));
  };

  const handleBPMChange = (newBpm: number) => {
    useAppStore.setState((state) => ({
      audio: { ...state.audio, bpm: newBpm },
    }));
  };

  const handleVolumeChange = (volume: number) => {
    useAppStore.setState((state) => ({
      audio: { ...state.audio, masterVolume: volume },
    }));
    if (audioEngine) {
      audioEngine.setMasterVolume(volume);
    }
  };

  const handleWaveformChange = (newWaveform: string) => {
    useAppStore.setState((state) => ({
      synthesis: { ...state.synthesis, waveform: newWaveform as any },
    }));
    if (audioEngine) {
      audioEngine.setWaveform(waveformMap[newWaveform] || 0);
    }
  };

  const handleADSRChange = (param: string, value: number) => {
    useAppStore.setState((state) => {
      const newADSR = { ...state.synthesis.adsr, [param]: value };
      if (audioEngine) {
        audioEngine.setADSR(
          newADSR.attack,
          newADSR.decay,
          newADSR.sustain,
          newADSR.release
        );
      }
      return {
        synthesis: { ...state.synthesis, adsr: newADSR },
      };
    });
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700 space-y-6">
      <h2 className="text-white text-xl font-semibold">Controls</h2>

      {/* Key Selection */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">Key</label>
        <select
          value={key}
          onChange={(e) => handleKeyChange(e.target.value)}
          className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          {NOTES.map((note) => (
            <option key={note} value={note}>
              {note} Major
            </option>
          ))}
        </select>
      </div>

      {/* Octave */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">
          Octave: {globalOctave}
        </label>
        <input
          type="range"
          min="1"
          max="6"
          value={globalOctave}
          onChange={(e) => handleOctaveChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* BPM */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">BPM: {bpm}</label>
        <input
          type="range"
          min="40"
          max="240"
          value={bpm}
          onChange={(e) => handleBPMChange(parseInt(e.target.value))}
          className="w-full"
        />
        <input
          type="number"
          min="40"
          max="240"
          value={bpm}
          onChange={(e) => handleBPMChange(parseInt(e.target.value))}
          className="w-full mt-2 bg-slate-700 text-white border border-slate-600 rounded px-3 py-2"
        />
      </div>

      {/* Volume */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">
          Volume: {Math.round(masterVolume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Waveform */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">Waveform</label>
        <select
          value={waveform}
          onChange={(e) => handleWaveformChange(e.target.value)}
          className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2 focus:outline-none focus:border-purple-500"
        >
          <option value="sine">Sine</option>
          <option value="sawtooth">Sawtooth</option>
          <option value="square">Square</option>
          <option value="triangle">Triangle</option>
          <option value="fm">FM (Wurlitzer)</option>
          <option value="piano">Piano</option>
        </select>
      </div>

      {/* ADSR */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">ADSR Envelope</label>
        <div className="space-y-2">
          <div>
            <label className="text-slate-300 text-xs">Attack: {(adsr.attack * 1000).toFixed(0)}ms</label>
            <input
              type="range"
              min="0.001"
              max="0.5"
              step="0.001"
              value={adsr.attack}
              onChange={(e) => handleADSRChange('attack', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs">Decay: {adsr.decay.toFixed(2)}s</label>
            <input
              type="range"
              min="0.001"
              max="5"
              step="0.01"
              value={adsr.decay}
              onChange={(e) => handleADSRChange('decay', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs">Sustain: {Math.round(adsr.sustain * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={adsr.sustain}
              onChange={(e) => handleADSRChange('sustain', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs">Release: {adsr.release.toFixed(2)}s</label>
            <input
              type="range"
              min="0.001"
              max="10"
              step="0.01"
              value={adsr.release}
              onChange={(e) => handleADSRChange('release', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white text-sm font-semibold">Filter</label>
          <button
            onClick={() => {
              const newEnabled = !synthesis.filter.enabled;
              useAppStore.setState((state) => ({
                synthesis: {
                  ...state.synthesis,
                  filter: { ...state.synthesis.filter, enabled: newEnabled },
                },
              }));
              if (audioEngine) {
                audioEngine.setFilterEnabled(newEnabled);
              }
            }}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
              synthesis.filter.enabled
                ? 'bg-green-500 text-white'
                : 'bg-slate-600 text-slate-300'
            }`}
          >
            {synthesis.filter.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {synthesis.filter.enabled && (
          <div className="space-y-2">
            <div>
              <label className="text-slate-300 text-xs">Mode</label>
              <select
                value={synthesis.filter.mode}
                onChange={(e) => {
                  const mode = parseInt(e.target.value);
                  useAppStore.setState((state) => ({
                    synthesis: {
                      ...state.synthesis,
                      filter: { ...state.synthesis.filter, mode },
                    },
                  }));
                  if (audioEngine) {
                    audioEngine.setFilterMode(mode);
                  }
                }}
                className="w-full bg-slate-700 text-white rounded px-2 py-1 text-sm"
              >
                <option value="0">Lowpass</option>
                <option value="1">Highpass</option>
                <option value="2">Bandpass</option>
              </select>
            </div>
            <div>
              <label className="text-slate-300 text-xs">Cutoff: {synthesis.filter.cutoff.toFixed(0)}Hz</label>
              <input
                type="range"
                min="20"
                max="20000"
                step="10"
                value={synthesis.filter.cutoff}
                onChange={(e) => {
                  const cutoff = parseFloat(e.target.value);
                  useAppStore.setState((state) => ({
                    synthesis: {
                      ...state.synthesis,
                      filter: { ...state.synthesis.filter, cutoff },
                    },
                  }));
                  if (audioEngine) {
                    audioEngine.setFilterCutoff(cutoff);
                  }
                }}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-slate-300 text-xs">Resonance: {synthesis.filter.resonance.toFixed(2)}</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={synthesis.filter.resonance}
                onChange={(e) => {
                  const resonance = parseFloat(e.target.value);
                  useAppStore.setState((state) => ({
                    synthesis: {
                      ...state.synthesis,
                      filter: { ...state.synthesis.filter, resonance },
                    },
                  }));
                  if (audioEngine) {
                    audioEngine.setFilterResonance(resonance);
                  }
                }}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Detune */}
      <div>
        <label className="text-white text-sm font-semibold mb-2 block">Detune</label>
        <label className="text-slate-300 text-xs">Amount: {synthesis.detune.toFixed(0)} cents</label>
        <input
          type="range"
          min="-50"
          max="50"
          step="1"
          value={synthesis.detune}
          onChange={(e) => {
            const detune = parseFloat(e.target.value);
            useAppStore.setState((state) => ({
              synthesis: {
                ...state.synthesis,
                detune,
              },
            }));
            if (audioEngine) {
              audioEngine.setDetune(detune);
            }
          }}
          className="w-full"
        />
        <p className="text-slate-400 text-xs mt-1">Subtle pitch variation</p>
      </div>
    </div>
  );
}

