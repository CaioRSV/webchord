import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  saveStateToLocalStorage,
  loadStateFromLocalStorage,
  exportStateAsJSON,
  encodeStateToURL,
} from '../../utils/statePersistence';

export default function PresetManager() {
  const [showExport, setShowExport] = useState(false);
  const [shareURL, setShareURL] = useState('');

  const handleSave = () => {
    const state = useAppStore.getState();
    saveStateToLocalStorage(state);
    alert('✅ Preset saved!');
  };

  const handleLoad = () => {
    const savedState = loadStateFromLocalStorage();
    if (savedState) {
      useAppStore.setState(savedState as any);
      alert('✅ Preset loaded!');
    } else {
      alert('❌ No saved preset found');
    }
  };

  const handleExportJSON = () => {
    const state = useAppStore.getState();
    const json = exportStateAsJSON(state);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webchord-preset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = e.target?.result as string;
            const state = JSON.parse(json);
            useAppStore.setState(state);
            alert('✅ Preset imported!');
          } catch (error) {
            alert('❌ Failed to import preset');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleGenerateURL = () => {
    const state = useAppStore.getState();
    const url = encodeStateToURL(state);
    setShareURL(url);
    setShowExport(true);
  };

  const handleCopyURL = () => {
    navigator.clipboard.writeText(shareURL);
    alert('✅ URL copied to clipboard!');
  };

  const handleRandomize = () => {
    const randomWaveform = ['sine', 'sawtooth', 'square', 'triangle', 'fm', 'piano'][
      Math.floor(Math.random() * 6)
    ];
    
    useAppStore.setState((state) => ({
      synthesis: {
        ...state.synthesis,
        waveform: randomWaveform as any,
        adsr: {
          attack: Math.random() * 2,
          decay: Math.random() * 2,
          sustain: 0.3 + Math.random() * 0.7,
          release: Math.random() * 5,
        },
      },
      audio: {
        ...state.audio,
        bpm: 60 + Math.floor(Math.random() * 180),
      },
    }));
    
    alert('🎲 Sound randomized!');
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
      <h3 className="text-white text-sm font-semibold mb-3">Preset Manager</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={handleSave}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition-all"
        >
          💾 Save
        </button>
        <button
          onClick={handleLoad}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-all"
        >
          📂 Load
        </button>
        <button
          onClick={handleExportJSON}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-all"
        >
          📤 Export
        </button>
        <button
          onClick={handleImportJSON}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-all"
        >
          📥 Import
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleGenerateURL}
          className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold transition-all"
        >
          🔗 Share URL
        </button>

        {showExport && (
          <div className="bg-slate-900/50 rounded p-2">
            <input
              type="text"
              value={shareURL}
              readOnly
              className="w-full bg-slate-800 text-white text-xs rounded px-2 py-1 mb-2"
            />
            <button
              onClick={handleCopyURL}
              className="w-full px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs font-semibold"
            >
              Copy URL
            </button>
          </div>
        )}

        <button
          onClick={handleRandomize}
          className="w-full px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-semibold transition-all"
        >
          🎲 Randomize
        </button>
      </div>
    </div>
  );
}

