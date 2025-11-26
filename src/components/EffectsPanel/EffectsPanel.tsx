import { useAppStore } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';

interface EffectsPanelProps {
  audioEngine: WasmAudioEngine | null;
}

export default function EffectsPanel({ audioEngine }: EffectsPanelProps) {
  const effects = useAppStore((state) => state.effects);

  const toggleEffect = (effect: keyof typeof effects) => {
    if (effect === 'stereo') return; // Stereo doesn't have enabled toggle
    
    const newEnabled = !(effects[effect] as any).enabled;
    
    useAppStore.setState((state) => ({
      effects: {
        ...state.effects,
        [effect]: {
          ...state.effects[effect],
          enabled: newEnabled,
        },
      },
    }));
    
    // Apply to audio engine
    if (audioEngine) {
      if (effect === 'glide') {
        const g = effects.glide;
        audioEngine.setGlideTime(newEnabled ? g.time : 0);
      } else if (effect === 'tremolo') {
        const t = effects.tremolo;
        audioEngine.setTremolo(newEnabled, t.rate, t.depth);
      } else if (effect === 'reverb') {
        const r = effects.reverb;
        // Map UI params to Rust: size→room_size, mix→damping
        audioEngine.setReverb(newEnabled, r.size, r.mix);
      } else if (effect === 'delay') {
        const d = effects.delay;
        audioEngine.setDelay(newEnabled, d.time, d.feedback, d.mix);
      } else if (effect === 'bass') {
        const b = effects.bass;
        audioEngine.setBassBoost(newEnabled, b.level);
      } else if (effect === 'flanger') {
        const f = effects.flanger;
        audioEngine.setFlanger(newEnabled, f.rate, f.depth, f.feedback, f.mix);
      }
    }
  };

  const updateEffectParam = (
    effect: keyof typeof effects,
    param: string,
    value: number | string
  ) => {
    useAppStore.setState((state) => ({
      effects: {
        ...state.effects,
        [effect]: {
          ...state.effects[effect],
          [param]: value,
        },
      },
    }));
    
    // Apply to audio engine in real-time
    if (audioEngine) {
      const e = effects[effect] as any;
      if (effect === 'glide' && e.enabled) {
        audioEngine.setGlideTime(param === 'time' ? value as number : e.time);
      } else if (effect === 'tremolo' && e.enabled) {
        audioEngine.setTremolo(true, 
          param === 'rate' ? value as number : e.rate,
          param === 'depth' ? value as number : e.depth
        );
      } else if (effect === 'reverb' && e.enabled) {
        // Map UI params to Rust: size→room_size, mix→damping
        audioEngine.setReverb(true,
          param === 'size' ? value as number : e.size,
          param === 'mix' ? value as number : e.mix
        );
      } else if (effect === 'delay' && e.enabled) {
        audioEngine.setDelay(true,
          param === 'time' ? value as number : e.time,
          param === 'feedback' ? value as number : e.feedback,
          param === 'mix' ? value as number : e.mix
        );
      } else if (effect === 'bass' && e.enabled) {
        audioEngine.setBassBoost(true,
          param === 'level' ? value as number : e.level
        );
      } else if (effect === 'flanger' && e.enabled) {
        audioEngine.setFlanger(true,
          param === 'rate' ? value as number : e.rate,
          param === 'depth' ? value as number : e.depth,
          param === 'feedback' ? value as number : e.feedback,
          param === 'mix' ? value as number : e.mix
        );
      }
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700">
      <h2 className="text-white text-xl font-semibold mb-4">Effects</h2>

      <div className="space-y-4">
        {/* Glide/Portamento */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Glide</label>
            <button
              onClick={() => toggleEffect('glide')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.glide.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.glide.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.glide.enabled && (
            <div>
              <label className="text-slate-300 text-xs">
                Time: {effects.glide.time.toFixed(0)}ms
              </label>
              <input
                type="range"
                min="0"
                max="2000"
                step="10"
                value={effects.glide.time}
                onChange={(e) =>
                  updateEffectParam('glide', 'time', parseFloat(e.target.value))
                }
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Tremolo */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Tremolo</label>
            <button
              onClick={() => toggleEffect('tremolo')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.tremolo.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.tremolo.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.tremolo.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-slate-300 text-xs">
                  Rate: {effects.tremolo.rate.toFixed(1)}Hz
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="20"
                  step="0.1"
                  value={effects.tremolo.rate}
                  onChange={(e) =>
                    updateEffectParam('tremolo', 'rate', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Depth: {Math.round(effects.tremolo.depth * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.tremolo.depth}
                  onChange={(e) =>
                    updateEffectParam('tremolo', 'depth', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Reverb */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Reverb</label>
            <button
              onClick={() => toggleEffect('reverb')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.reverb.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.reverb.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.reverb.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-slate-300 text-xs">
                  Size: {Math.round(effects.reverb.size * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.reverb.size}
                  onChange={(e) =>
                    updateEffectParam('reverb', 'size', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Mix: {Math.round(effects.reverb.mix * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.reverb.mix}
                  onChange={(e) =>
                    updateEffectParam('reverb', 'mix', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Flanger */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Flanger</label>
            <button
              onClick={() => toggleEffect('flanger')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.flanger.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.flanger.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.flanger.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-slate-300 text-xs">
                  Rate: {effects.flanger.rate.toFixed(2)}Hz
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={effects.flanger.rate}
                  onChange={(e) =>
                    updateEffectParam('flanger', 'rate', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Depth: {effects.flanger.depth.toFixed(1)}ms
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={effects.flanger.depth}
                  onChange={(e) =>
                    updateEffectParam('flanger', 'depth', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Feedback: {Math.round(effects.flanger.feedback * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={effects.flanger.feedback}
                  onChange={(e) =>
                    updateEffectParam('flanger', 'feedback', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Mix: {Math.round(effects.flanger.mix * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.flanger.mix}
                  onChange={(e) =>
                    updateEffectParam('flanger', 'mix', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Delay */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Delay</label>
            <button
              onClick={() => toggleEffect('delay')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.delay.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.delay.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.delay.enabled && (
            <div className="space-y-2">
              <div>
                <label className="text-slate-300 text-xs">
                  Time: {effects.delay.time.toFixed(2)}s
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="2"
                  step="0.01"
                  value={effects.delay.time}
                  onChange={(e) =>
                    updateEffectParam('delay', 'time', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Feedback: {Math.round(effects.delay.feedback * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.01"
                  value={effects.delay.feedback}
                  onChange={(e) =>
                    updateEffectParam('delay', 'feedback', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-300 text-xs">
                  Mix: {Math.round(effects.delay.mix * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={effects.delay.mix}
                  onChange={(e) =>
                    updateEffectParam('delay', 'mix', parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bass Boost */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-white text-sm font-semibold">Bass Boost</label>
            <button
              onClick={() => toggleEffect('bass')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                effects.bass.enabled
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}
            >
              {effects.bass.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {effects.bass.enabled && (
            <div>
              <label className="text-slate-300 text-xs">
                Level: {Math.round(effects.bass.level * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effects.bass.level}
                onChange={(e) =>
                  updateEffectParam('bass', 'level', parseFloat(e.target.value))
                }
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Stereo Width */}
        <div className="bg-slate-700/50 rounded-lg p-4">
          <label className="text-white text-sm font-semibold block mb-2">
            Stereo Width
          </label>
          <div className="flex gap-2">
            {(['mono', 'stereo', 'wide'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  useAppStore.setState((state) => ({
                    effects: {
                      ...state.effects,
                      stereo: { mode },
                    },
                  }));
                }}
                className={`flex-1 px-3 py-2 rounded text-xs font-semibold transition-all ${
                  effects.stereo.mode === mode
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

