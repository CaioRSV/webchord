# 🎹 WebChord - Professional Browser-Based Chord Synthesizer

A powerful, professional-grade chord synthesizer that runs entirely in your browser, featuring a **Rust/WebAssembly DSP audio engine** for near-native performance and the **Nashville Number System** for intuitive chord-based music creation.

![WebChord](https://img.shields.io/badge/WebChord-v1.0-purple?style=for-the-badge)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react)
![Rust](https://img.shields.io/badge/Rust-WebAssembly-orange?style=for-the-badge&logo=rust)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript)

---
<img width="2368" height="1246" alt="image" src="https://github.com/user-attachments/assets/2c2aca6a-47e4-40a8-b047-4327d96b94de" />

## ✨ Key Features

### 🎼 Music Creation
- **Nashville Number System**: Play chords by scale degree (I, ii, iii, IV, V, vi, vii°)
- **AI Chord Suggestions** 🎯: 
  - Real-time next chord predictions using Markov Chains + Music Theory + Randomization
  - 4 varied suggestions with probability indicators
  - Smart analysis of your playing patterns
  - Instant feedback when you match predictions
  - Creativity bonus for exciting and unexpected progressions

- **Multiple Playback Modes**: 
  - Play Mode: Direct chord playback
  - Arpeggiator: Up, Down, Up-Down, Random patterns with configurable speed, octave range, and gate
- **Pattern Recording**: Record your performances in real-time with precise timing
- **Multi-Track Timeline**: Arrange recorded patterns on an unlimited timeline with drag-and-drop
- **Loop System**: Loop playback with dynamic endpoints

### 🎛️ Professional Synthesis Engine (Rust/WASM)
- **6 Waveforms**: Sine, Sawtooth, Square, Triangle, FM, Piano
- **ADSR Envelope**: Sample-accurate envelope with full Attack, Decay, Sustain, Release control
- **State-Variable Filter**: Lowpass, Highpass, Bandpass with cutoff & resonance
- **LFO Modulation**: 4 waveforms (Sine, Triangle, Square, Sample & Hold) with filter modulation
- **Polyphonic**: Up to 16 simultaneous voices
- **Detune**: Fine-tune oscillators for richer sounds (±50 cents)
- **PolyBLEP Anti-aliasing**: Band-limited waveforms for professional audio quality

### 🎚️ Effects Chain (Rust/WASM)
- **Glide/Portamento**: Smooth pitch transitions (0-2000ms)
- **Tremolo**: Amplitude modulation with rate and depth control
- **Flanger**: Chorus-like effect with LFO-modulated delay
- **Delay**: Echo effect with time, feedback, and mix controls
- **Reverb**: Freeverb-style reverb with room size and damping

### 🎨 Artist Presets
Pre-configured sound palettes inspired by renowned artists:
- **Oneheart** - Melancholic Electronic
- **Skeler** - Dark Synthwave
- **Eevee** - Dreamy Lofi
- **Jinsang** - Smooth Lofi Hip-Hop
- **Saib** - Jazzy Lofi
- **Deadcrow** - Dark Electronic
- **Idealism** - Ambient Lofi
- **Sleepy Fish** - Dreamy Chill
- **In Love With A Ghost** - Upbeat Chiptune Lofi

### 🔧 State Management & Persistence
- **LocalStorage**: Auto-save your settings
- **URL Sharing**: Share your configurations via URL
- **JSON Export/Import**: Save and load complete presets
- **Randomize**: Generate random musical settings for inspiration

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Rust** and **wasm-pack** (for building the audio engine)
- A modern browser with Web Audio API and WebAssembly support (Chrome, Firefox, Edge, Safari)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/webchord.git
cd webchord
```

2. **Build the Rust/WASM audio engine**
```bash
cd rust-dsp
wasm-pack build --target web --out-dir ../src/audio/wasm
cd ..
```

3. **Install dependencies**
```bash
npm install
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173` and click **"Start Audio Engine"**

### Building for Production

```bash
npm run build
```

The optimized build will be in the `dist/` folder.

---

## 🎹 How to Use

### Basic Playback
1. **Select a Key**: Choose your musical key (C, D, E, F, G, A, B with major scale)
2. **Adjust Octave**: Set the base octave (1-6)
3. **Play Chords**: 
   - Click buttons **1-7** (or press keyboard keys **1-7**)
   - Each number represents a scale degree in the Nashville Number System
4. **Release Mode**: Toggle between Fixed Release (ADSR) or Immediate Release

### Recording & Timeline
1. **Arm Recording**: Click the 🔴 **ARM** button
2. **Play Your Chords**: Recording starts automatically on the first note
3. **Stop Recording**: Click ⏹ **STOP**
4. **Save Pattern**: Give it a name and save
5. **Drag to Timeline**: Drag patterns from the library to the timeline
6. **Playback**: Click ▶️ to play your arrangement
7. **Loop**: Enable loop mode to repeat your composition

### Sound Design
- **Synthesis Tab**: Configure oscillator, ADSR, filter, LFO, and detune
- **Effects Tab**: Add glide, tremolo, flanger, delay, and reverb
- **Artist Presets**: Load pre-configured sounds from famous artists
- **Preset Manager**: Save, load, export, import, and share your creations

---

## 🏗️ Architecture

### Tech Stack

#### Frontend
- **React 18** with TypeScript
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Vite** for blazing-fast builds
- **Web Audio API** for audio context management

#### Audio Engine (Backend)
- **Rust** compiled to **WebAssembly** for near-native performance
- **wasm-bindgen** for JavaScript interop
- **ScriptProcessorNode** for real-time audio processing
- All DSP processing happens in **Rust** (oscillators, ADSR, filters, LFO, effects)

### Project Structure

```
webchord/
├── rust-dsp/               # Rust/WASM audio engine
│   ├── src/
│   │   ├── lib.rs         # Main audio engine
│   │   ├── oscillator.rs  # Waveform generators
│   │   ├── envelope.rs    # ADSR envelope
│   │   ├── filter.rs      # State-variable filter
│   │   ├── lfo.rs         # Low-frequency oscillator
│   │   ├── voice.rs       # Polyphonic voice
│   │   └── effects/       # Effects modules
│   │       ├── glide.rs
│   │       ├── tremolo.rs
│   │       ├── flanger.rs
│   │       ├── delay.rs
│   │       └── reverb.rs
│   └── Cargo.toml
├── src/
│   ├── audio/
│   │   ├── WasmAudioEngine.ts  # TypeScript wrapper for WASM
│   │   └── wasm/               # Compiled WASM output
│   ├── components/             # React components
│   │   ├── ChordButtons/
│   │   ├── ControlPanel/
│   │   ├── EffectsPanel/
│   │   ├── Timeline/
│   │   ├── PatternRecorder/
│   │   └── ...
│   ├── music/                  # Music theory
│   │   ├── chords.ts          # Nashville Number System
│   │   └── scales.ts          # Scale generation
│   ├── presets/
│   │   └── artistPresets.ts   # Artist-inspired presets
│   ├── store/
│   │   └── useAppStore.ts     # Zustand state management
│   └── utils/
│       └── statePersistence.ts # LocalStorage & URL encoding
└── package.json
```

### Key Design Decisions

1. **Rust for DSP**: All audio generation happens in Rust/WASM for maximum performance and minimal latency
2. **Nashville Number System**: Simplifies music theory for non-musicians (scale degrees instead of chord names)
3. **Pattern-Based Workflow**: Inspired by DAWs like Ableton Live and FL Studio
4. **Captured Parameters**: Recorded patterns preserve their sound settings independently from global parameters
5. **Real-Time Performance**: Zero-copy audio processing with optimized Rust code

---

## 🎵 Nashville Number System Explained

The **Nashville Number System** is a music notation method that uses numbers (1-7) to represent chords based on their scale degree:

| Number | Chord Type | Example in C Major |
|--------|------------|-------------------|
| **1 (I)** | Major | C Major |
| **2 (ii)** | Minor | D minor |
| **3 (iii)** | Minor | E minor |
| **4 (IV)** | Major | F Major |
| **5 (V)** | Major | G Major |
| **6 (vi)** | Minor | A minor |
| **7 (vii°)** | Diminished | B diminished |

**Benefits**:
- Transpose instantly by changing the key
- Universal across all musical keys
- Focus on chord relationships, not absolute pitches

---

## 🔊 Audio Performance

- **Sample Rate**: 48kHz (standard)
- **Polyphony**: 16 voices
- **Latency**: ~10-20ms (browser-dependent)
- **CPU Usage**: Optimized Rust code ensures minimal overhead
- **Audio Quality**: 32-bit float processing, PolyBLEP anti-aliasing

---

## 🛠️ Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Rebuild WASM engine (from rust-dsp folder)
wasm-pack build --target web --out-dir ../src/audio/wasm
```

### Adding New Features

#### Adding a New Effect (Rust)
1. Create effect module in `rust-dsp/src/effects/new_effect.rs`
2. Implement processing logic
3. Expose in `rust-dsp/src/lib.rs`
4. Add TypeScript wrapper in `src/audio/WasmAudioEngine.ts`
5. Create UI controls in `src/components/EffectsPanel/EffectsPanel.tsx`

#### Adding a New Artist Preset
1. Open `src/presets/artistPresets.ts`
2. Add a new preset object with all parameters
3. The preset will automatically appear in the UI

### Understanding the Chord Suggestion Engine

The AI chord suggestion system uses a sophisticated multi-layered approach:

**1. 2nd-Order Markov Chains (70% weight)**
- Analyzes patterns like I-V-vi-IV, ii-V-I
- Considers the last 2 chords played
- Trained on thousands of popular song progressions

**2. Music Theory Rules (10% weight)**
- Circle of Fifths relationships (perfect 5th progressions)
- Functional Harmony (Tonic → Subdominant → Dominant → Tonic)
- Voice leading principles

**3. Creativity Randomization (15% weight)**
- Random boost to all chords (5-20% variation)
- Extra emphasis on adventurous choices (iii, vii°)
- Ensures suggestions are exciting and unpredictable

**4. Pattern Analysis**
- Measures predictability (how often you follow common progressions)
- Provides real-time pattern matching stats

The system provides:
- **Top 4 Suggestions** with probability percentages
- **Category Labels**: Strong, Moderate, Adventurous
- **Reason Explanations**: "Common progression", "Natural resolution", "Creative choice", etc.
- **Visual Feedback**: Highlights and animations when you match predictions
- **Compact 2x2 Grid**: Positioned between chord buttons and artist presets for easy access

---

## 🐛 Known Limitations

- **iOS Safari**: Requires user gesture to start audio context (tap "Start Audio Engine")
- **Audio Worklet**: Not used due to WASM import limitations; using `ScriptProcessorNode` instead
- **SharedArrayBuffer**: Not required (commented out in code)
- **Browser Compatibility**: Requires modern browser with Web Audio API v1 and WebAssembly MVP

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by hardware synthesizers like the **HiChord**
- Nashville Number System methodology
- Artist sound palettes inspired by the lofi/electronic music community
- Freeverb reverb algorithm
- PolyBLEP anti-aliasing technique

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Areas for Contribution
- Additional waveforms (wavetables, additive synthesis)
- More effects (chorus, phaser, compressor)
- MIDI input support
- Audio export/rendering
- Mobile touch optimizations
- Accessibility improvements

---

## 📧 Contact

For questions, suggestions, or bug reports, please open an issue on GitHub.

---

**Made with ❤️ and Rust** 🦀

**Enjoy creating music!** 🎵✨

