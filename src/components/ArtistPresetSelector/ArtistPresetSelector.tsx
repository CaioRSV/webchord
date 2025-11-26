import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { WasmAudioEngine } from '../../audio/WasmAudioEngine';
import { artistPresets, defaultPreset, getAllPresets, ArtistPreset } from '../../presets/artistPresets';
import { getArtistGenerativeConfig } from '../../utils/artistToGenerativeMapping';
import { generateProceduralProgression } from '../../utils/proceduralMusicGenerator';
import { generateChord } from '../../music/chords';
import { RecordedNote, Pattern } from '../../store/useAppStore';

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

  const generatePatternFromArtist = (preset: ArtistPreset, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent applying the preset when clicking generate
    
    const artistConfig = getArtistGenerativeConfig(preset.artist);
    if (!artistConfig) {
      console.warn(`No generative mapping for artist: ${preset.artist}`);
      return;
    }
    
    console.log(`✨ Generating pattern for ${preset.artist}: ${artistConfig.description}`);
    
    // Generate progression
    const key = useAppStore.getState().music.key;
    const bpm = useAppStore.getState().audio.bpm;
    const globalOctave = useAppStore.getState().music.globalOctave;
    
    const generatedSlots = generateProceduralProgression(artistConfig.config, key);
    
    // Convert to timeline format
    const secondsPerBeat = 60 / bpm;
    const totalLengthSeconds = 16 * secondsPerBeat;
    const notes: RecordedNote[] = [];
    
    generatedSlots.forEach((slot) => {
      if (slot.degree === null) return;
      
      const startBeat = slot.position;
      let startTime = startBeat * secondsPerBeat * 1000;
      
      // Apply swing
      const swingAmount = slot.swing * secondsPerBeat * 100;
      startTime += swingAmount;
      
      const humanize = (Math.random() - 0.5) * 15;
      const actualStartTime = startTime + humanize;
      
      try {
        const chord = generateChord(key, slot.degree, undefined, 0, globalOctave);
        const baseStagger = 5 + (slot.stagger * 15);
        
        // Note on
        chord.forEach((midiNote, noteIndex) => {
          notes.push({
            midiNote,
            velocity: slot.velocity,
            type: 'noteOn' as const,
            time: actualStartTime + (noteIndex * baseStagger),
            degree: 0,
          });
        });
        
        // Note off
        const noteDuration = slot.duration * secondsPerBeat * 1000;
        const durationMultiplier = 0.88 + (slot.stagger * 0.08);
        const endTime = actualStartTime + (noteDuration * durationMultiplier);
        
        chord.forEach((midiNote, noteIndex) => {
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
    
    // Create pattern name
    const romanNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const chordDegrees = generatedSlots
      .filter(s => s.degree !== null)
      .map(s => romanNumerals[(s.degree as number) - 1]);
    
    const progressionName = `${preset.artist} (${chordDegrees.slice(0, 4).join('-')}...)`;
    
    // Use artist-specific color based on genre
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
    const color = genreColors[preset.genre] || '#8b5cf6';
    
    const newPattern: Pattern = {
      id: `pattern-${Date.now()}`,
      name: progressionName,
      length: totalLengthSeconds,
      notes,
      color,
      // Capture the artist's preset parameters
      capturedParameters: {
        waveform: preset.waveform,
        adsr: preset.adsr,
        filter: preset.filter,
        lfo: preset.lfo,
        detune: preset.detune,
        effects: {
          ...preset.effects,
          bass: { enabled: false, level: 0.5 }, // Add missing bass property
          stereo: { mode: 'stereo' }, // Add missing stereo property
        },
      },
    };
    
    // Add to patterns list
    useAppStore.setState((state) => ({
      sequencer: {
        ...state.sequencer,
        patterns: [...state.sequencer.patterns, newPattern],
      },
    }));
    
    console.log(`✨ Generated ${preset.artist} pattern: ${chordDegrees.join(' → ')}`);
    console.log(`   • ${artistConfig.description}`);
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
        <div
          className={`p-3 rounded-lg transition-all relative group ${
            selectedPresetId === 'default'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 border-2 border-purple-400 shadow-lg'
              : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700 hover:border-purple-500'
          }`}
        >
          <button
            onClick={() => applyPreset(defaultPreset)}
            className="w-full text-left"
          >
            <div className="text-white text-xs font-bold mb-1">Default</div>
            <div className="text-slate-300 text-xs">Clean Synth</div>
          </button>
          
          {/* Generate Pattern Button - Default uses neutral settings */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // For default, we don't have an artist mapping, so just show a message
              alert('💡 Select an artist preset first, then hover and click ✨ to generate in their style!');
            }}
            className="absolute top-1 right-1 p-1.5 rounded-md bg-purple-500/80 hover:bg-purple-400 text-white text-xs font-bold transition-all opacity-0 group-hover:opacity-100 shadow-lg hover:scale-110"
            title="Select an artist first to generate patterns"
          >
            ✨
          </button>
        </div>

        {/* Artist Presets */}
        {artistPresets.map((preset) => (
          <div
            key={preset.id}
            className={`p-3 rounded-lg transition-all relative group ${
              selectedPresetId === preset.id
                ? 'bg-gradient-to-br from-pink-600 to-purple-600 border-2 border-pink-400 shadow-lg'
                : 'bg-slate-700/50 border border-slate-600 hover:bg-slate-700 hover:border-pink-500'
            }`}
          >
            <button
              onClick={() => applyPreset(preset)}
              className="w-full text-left"
            >
              <div className="text-white text-xs font-bold mb-1 truncate">{preset.artist}</div>
              <div className="text-slate-300 text-xs truncate">{preset.genre}</div>
              <div className="text-slate-400 text-xs mt-1">{preset.bpm} BPM</div>
            </button>
            
            {/* Generate Pattern Button */}
            <button
              onClick={(e) => generatePatternFromArtist(preset, e)}
              className="absolute top-1 right-1 p-1.5 rounded-md bg-purple-500/80 hover:bg-purple-400 text-white text-xs font-bold transition-all opacity-0 group-hover:opacity-100 shadow-lg hover:scale-110"
              title={`Generate ${preset.artist}-style pattern`}
            >
              ✨
            </button>
          </div>
        ))}
      </div>

      {/* Quick Info */}
      <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <p className="text-blue-200 text-xs mb-1">
          💡 <strong>Tip:</strong> Each preset instantly configures all synthesis, filter, LFO, and effects parameters to match the artist's signature sound!
        </p>
        <p className="text-purple-200 text-xs">
          ✨ <strong>New:</strong> Hover over any preset and click ✨ to generate a pattern in that artist's style!
        </p>
      </div>
    </div>
  );
}

