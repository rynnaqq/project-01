import { useAudio } from '../context/AudioProvider';

/** Compact music/SFX toggle control for the app header. */
export default function AudioControls() {
  const { musicEnabled, sfxEnabled, toggleMusic, toggleSfx } = useAudio();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Audio controls">
      <button
        type="button"
        onClick={toggleMusic}
        aria-pressed={musicEnabled}
        title={musicEnabled ? 'Turn music off' : 'Turn music on'}
        className={`rounded-md px-2 py-1.5 text-sm transition ${
          musicEnabled
            ? 'bg-arcade-accent/20 text-arcade-neon'
            : 'text-gray-500 line-through hover:bg-white/5'
        }`}
      >
        ♪ <span className="sr-only">Music {musicEnabled ? 'on' : 'off'}</span>
      </button>
      <button
        type="button"
        onClick={toggleSfx}
        aria-pressed={sfxEnabled}
        title={sfxEnabled ? 'Turn sound effects off' : 'Turn sound effects on'}
        className={`rounded-md px-2 py-1.5 text-sm transition ${
          sfxEnabled ? 'bg-arcade-accent/20 text-arcade-neon' : 'text-gray-400 hover:bg-white/5'
        }`}
      >
        {sfxEnabled ? '🔊' : '🔇'} <span className="sr-only">Sound effects</span>
      </button>
    </div>
  );
}
