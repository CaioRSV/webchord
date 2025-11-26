import { useAppStore } from '../../store/useAppStore';

export default function PlaybackModes() {
  const currentMode = useAppStore((state) => state.audio.currentMode);
  const arpeggiator = useAppStore((state) => state.playback.arpeggiator);

  const setMode = (mode: any) => {
    useAppStore.setState((state) => ({
      audio: { ...state.audio, currentMode: mode },
    }));
  };

  const updateArpeggiator = (param: string, value: any) => {
    useAppStore.setState((state) => ({
      playback: {
        ...state.playback,
        arpeggiator: {
          ...state.playback.arpeggiator,
          [param]: value,
        },
      },
    }));
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700">
      <h2 className="text-white text-xl font-semibold mb-4">Playback Modes</h2>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {(['play', 'arpeggiator'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMode(mode)}
            className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
              currentMode === mode
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {mode === 'play' && '🎹 Play'}
            {mode === 'arpeggiator' && '🎵 Arpeggiator'}
          </button>
        ))}
      </div>

      {/* Arpeggiator Settings */}
      {currentMode === 'arpeggiator' && (
        <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
          <h3 className="text-white text-sm font-semibold">Arpeggiator Settings</h3>

          <div>
            <label className="text-slate-300 text-xs block mb-1">Pattern</label>
            <div className="grid grid-cols-4 gap-1">
              {(['up', 'down', 'updown', 'random'] as const).map((pattern) => (
                <button
                  key={pattern}
                  onClick={() => updateArpeggiator('pattern', pattern)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                    arpeggiator.pattern === pattern
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {pattern.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs block mb-1">
              Speed: {arpeggiator.speed}x
            </label>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.25"
              value={arpeggiator.speed}
              onChange={(e) =>
                updateArpeggiator('speed', parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs block mb-1">
              Octave Range: {arpeggiator.octaves}
            </label>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={arpeggiator.octaves}
              onChange={(e) =>
                updateArpeggiator('octaves', parseInt(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs block mb-1">
              Gate: {Math.round(arpeggiator.gate * 100)}%
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={arpeggiator.gate}
              onChange={(e) =>
                updateArpeggiator('gate', parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>
        </div>
      )}

    </div>
  );
}

