import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { audioController, type SfxType } from '../lib/audio';

const MUSIC_KEY = 'arcade.audio.music';
const SFX_KEY = 'arcade.audio.sfx';

function readBool(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === 'true';
}

type AudioContextValue = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  unlocked: boolean;
  toggleMusic: () => void;
  toggleSfx: () => void;
  playSfx: (type: SfxType) => void;
};

const AudioCtx = createContext<AudioContextValue | undefined>(undefined);

/**
 * Global audio state provider. Persists music/SFX preferences to localStorage
 * and unlocks the AudioContext on the first user gesture (autoplay policy).
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const [musicEnabled, setMusicEnabled] = useState(() => readBool(MUSIC_KEY, false));
  const [sfxEnabled, setSfxEnabled] = useState(() => readBool(SFX_KEY, true));
  const [unlocked, setUnlocked] = useState(false);

  // Apply preferences to the controller.
  useEffect(() => {
    audioController.setSfxEnabled(sfxEnabled);
  }, [sfxEnabled]);

  useEffect(() => {
    audioController.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  // Unlock audio on first interaction (required by browsers).
  useEffect(() => {
    if (unlocked) return;
    const handler = async () => {
      await audioController.unlock();
      setUnlocked(audioController.isUnlocked());
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, handler, { once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [unlocked]);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(MUSIC_KEY, String(next));
      return next;
    });
  }, []);

  const toggleSfx = useCallback(() => {
    setSfxEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(SFX_KEY, String(next));
      return next;
    });
  }, []);

  const playSfx = useCallback((type: SfxType) => {
    audioController.playSfx(type);
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({ musicEnabled, sfxEnabled, unlocked, toggleMusic, toggleSfx, playSfx }),
    [musicEnabled, sfxEnabled, unlocked, toggleMusic, toggleSfx, playSfx],
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}
