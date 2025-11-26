import { useAppStore } from '../../store/useAppStore';
import { ChordModType } from '../../music/chords';

const MODIFICATIONS: ChordModType[] = [
  'maj/min',
  '7th',
  'maj7/min7',
  'maj9/min9',
  'sus4',
  'sus2/add6',
  'dim',
  'aug',
];

const MOD_POSITIONS = [
  { x: 0.5, y: 0 },      // North: maj/min
  { x: 0.85, y: 0.15 },  // North-East: 7th
  { x: 1, y: 0.5 },      // East: maj7/min7
  { x: 0.85, y: 0.85 },  // South-East: maj9/min9
  { x: 0.5, y: 1 },      // South: sus4
  { x: 0.15, y: 0.85 },  // South-West: sus2/add6
  { x: 0, y: 0.5 },      // West: dim
  { x: 0.15, y: 0.15 },  // North-West: aug
];

export default function ChordModifier() {
  const currentMod = useAppStore((state) => state.music.currentChordModification);
  const setCurrentMod = useAppStore((state) => {
    return (mod: ChordModType | null) => {
      state.music.currentChordModification = mod;
    };
  });

  const handleClick = (mod: ChordModType) => {
    setCurrentMod(mod === currentMod ? null : mod);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 border border-slate-700">
      <h3 className="text-white text-sm font-semibold mb-4">Chord Modifier</h3>
      <div className="relative w-64 h-64 mx-auto">
        {/* Radial selector */}
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Center circle */}
          <circle
            cx="100"
            cy="100"
            r="30"
            fill={currentMod ? 'rgba(139, 92, 246, 0.3)' : 'rgba(51, 65, 85, 0.5)'}
            stroke="rgba(139, 92, 246, 0.5)"
            strokeWidth="2"
            className="cursor-pointer"
            onClick={() => setCurrentMod(null)}
          />
          <text
            x="100"
            y="105"
            textAnchor="middle"
            fill="white"
            fontSize="12"
            className="pointer-events-none"
          >
            {currentMod || 'None'}
          </text>

          {/* Modification buttons */}
          {MODIFICATIONS.map((mod, index) => {
            const pos = MOD_POSITIONS[index];
            const x = pos.x * 200;
            const y = pos.y * 200;
            const isActive = currentMod === mod;

            return (
              <g key={mod}>
                <circle
                  cx={x}
                  cy={y}
                  r="20"
                  fill={isActive ? 'rgba(139, 92, 246, 0.8)' : 'rgba(51, 65, 85, 0.7)'}
                  stroke={isActive ? 'rgb(139, 92, 246)' : 'rgba(148, 163, 184, 0.5)'}
                  strokeWidth={isActive ? '2' : '1'}
                  className="cursor-pointer hover:fill-purple-600"
                  onClick={() => handleClick(mod)}
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  className="pointer-events-none"
                >
                  {mod.split('/')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

