import { useAudio } from '../context/AudioProvider';
import { MusicIcon, VolumeOffIcon, VolumeOnIcon } from './icons';

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
        aria-label={`Music ${musicEnabled ? 'on' : 'off'}`}
        className={`cursor-pointer rounded-full p-2 transition-all ${
          musicEnabled
            ? 'bg-arcade-neon/15 text-arcade-neon ring-1 ring-inset ring-arcade-neon/30'
            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
        }`}
      >
        <MusicIcon size={16} />
      </button>
      <button
        type="button"
        onClick={toggleSfx}
        aria-pressed={sfxEnabled}
        title={sfxEnabled ? 'Turn sound effects off' : 'Turn sound effects on'}
        aria-label={`Sound effects ${sfxEnabled ? 'on' : 'off'}`}
        className={`cursor-pointer rounded-full p-2 transition-all ${
          sfxEnabled
            ? 'bg-arcade-neon/15 text-arcade-neon ring-1 ring-inset ring-arcade-neon/30'
            : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
        }`}
      >
        {sfxEnabled ? <VolumeOnIcon size={16} /> : <VolumeOffIcon size={16} />}
      </button>
    </div>
  );
}
