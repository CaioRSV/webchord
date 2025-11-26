import { useEffect, useState } from 'react';
import { WasmAudioEngine } from './audio/WasmAudioEngine';
import { useAppStore } from './store/useAppStore';
import { loadStateFromLocalStorage, decodeStateFromURL } from './utils/statePersistence';
import ChordButtons from './components/ChordButtons/ChordButtons';
import ControlPanel from './components/ControlPanel/ControlPanel';
import EffectsPanel from './components/EffectsPanel/EffectsPanel';
import PresetManager from './components/PresetManager/PresetManager';
import PlaybackModes from './components/PlaybackModes/PlaybackModes';
import PatternRecorder from './components/PatternRecorder/PatternRecorder';
import Timeline from './components/Timeline/Timeline';
import Visualizer from './components/Visualizer/Visualizer';
import ArtistPresetSelector from './components/ArtistPresetSelector/ArtistPresetSelector';

function App() {
  const [audioEngine, setAudioEngine] = useState<WasmAudioEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load state from URL or localStorage
    const urlState = decodeStateFromURL();
    const savedState = urlState || loadStateFromLocalStorage();
    
    if (savedState) {
      useAppStore.setState(savedState as any);
      console.log('📂 State restored');
    }

    const engine = new WasmAudioEngine();
    setAudioEngine(engine);

    return () => {
      engine.dispose();
    };
  }, []);

  const handleStartAudio = async () => {
    if (!audioEngine) return;

    try {
      await audioEngine.initialize();
      await audioEngine.start();
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize audio');
      console.error('Audio initialization error:', err);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">WebChord</h1>
          <p className="text-blue-300 mb-6">Browser-Based Chord Synthesizer</p>
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-4 text-red-200">
              {error}
            </div>
          )}
          <button
            onClick={handleStartAudio}
            className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-full text-xl font-semibold hover:from-pink-600 hover:to-purple-600 transition-all shadow-lg"
          >
            Start Audio Engine
          </button>
          <p className="text-slate-400 text-sm mt-4">
            Requires browser with Web Audio API and WebAssembly support
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col">
      {/* Fixed Top Bar - Recording & Visualization */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b-2 border-purple-600 shadow-2xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title - Compact */}
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                WebChord
              </div>
            </div>

            {/* Recording Controls - PROMINENT */}
            <div className="flex-1 max-w-md">
              <PatternRecorder />
            </div>

            {/* Visualizer - Compact Horizontal */}
            <div className="flex-1 max-w-lg">
              <Visualizer audioEngine={audioEngine} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Console Layout */}
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          
          {/* LEFT SIDEBAR - Synthesis Parameters */}
          <div className="xl:col-span-3 space-y-3">
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">🎛️</span> SYNTHESIS
              </h3>
              <ControlPanel audioEngine={audioEngine} />
            </div>
          </div>

          {/* CENTER - Main Performance Area */}
          <div className="xl:col-span-6 space-y-3">
            <ChordButtons audioEngine={audioEngine} />
            <PlaybackModes />
          </div>

          {/* RIGHT SIDEBAR - Effects & Utilities */}
          <div className="xl:col-span-3 space-y-3">
            <ArtistPresetSelector audioEngine={audioEngine} />
            
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">✨</span> EFFECTS
              </h3>
              <EffectsPanel audioEngine={audioEngine} />
            </div>
            
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-4 border border-slate-700">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                <span className="text-xl">💾</span> PRESETS
              </h3>
              <PresetManager />
            </div>
          </div>
        </div>

        {/* Bottom Section - Timeline (Full Width) */}
        <div className="mt-6">
          <Timeline audioEngine={audioEngine} />
        </div>
      </div>
    </div>
  );
}

export default App;

