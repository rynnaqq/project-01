import React, { useState } from 'react';
import type { QualityTier } from '../core/qualityManager';
import type { MissionProgress } from '../core/progressManager';

interface SpaceSimulatorUIProps {
  gameState: string;
  qualityTier: QualityTier;
  reducedMotion: boolean;
  isMuted: boolean;
  masterVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  progress: MissionProgress;
  cupolaActive: boolean;
  onStartMission: () => void;
  onResumeCheckpoint?: () => void;
  onSetQualityTier: (tier: QualityTier) => void;
  onToggleReducedMotion: () => void;
  onToggleMute: () => void;
  onSetVolumes: (master: number, sfx: number, voice: number, ambient: number) => void;
  onTouchMove: (x: number, y: number, z: number) => void;
  onTouchLook: (x: number, y: number) => void;
  onTouchButtons: (boost: boolean, brake: boolean, interact: boolean) => void;
  onToggleFlashlight: () => void;
  onSkipCutscene: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  isSettingsOpen: boolean;
}

export const SpaceSimulatorUI: React.FC<SpaceSimulatorUIProps> = ({
  gameState,
  qualityTier,
  reducedMotion,
  isMuted,
  masterVolume,
  sfxVolume,
  voiceVolume,
  ambientVolume,
  progress,
  cupolaActive,
  onStartMission,
  onResumeCheckpoint,
  onSetQualityTier,
  onToggleReducedMotion,
  onToggleMute,
  onSetVolumes,
  onTouchMove,
  onTouchLook,
  onTouchButtons,
  onToggleFlashlight,
  onSkipCutscene,
  onOpenSettings,
  onCloseSettings,
  isSettingsOpen,
}) => {
  const [showCredits, setShowCredits] = useState(false);
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  );

  // Touch joystick tracking
  const [leftJoyActive, setLeftJoyActive] = useState(false);
  const [leftJoyOffset, setLeftJoyOffset] = useState({ x: 0, y: 0 });
  const [rightJoyActive, setRightJoyActive] = useState(false);
  const [rightJoyOffset, setRightJoyOffset] = useState({ x: 0, y: 0 });

  const handleLeftTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.max(-45, Math.min(45, touch.clientX - centerX));
    const dy = Math.max(-45, Math.min(45, touch.clientY - centerY));
    setLeftJoyOffset({ x: dx, y: dy });
    onTouchMove(dx / 45, 0, -dy / 45);
  };

  const handleLeftTouchEnd = () => {
    setLeftJoyActive(false);
    setLeftJoyOffset({ x: 0, y: 0 });
    onTouchMove(0, 0, 0);
  };

  const handleRightTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.max(-45, Math.min(45, touch.clientX - centerX));
    const dy = Math.max(-45, Math.min(45, touch.clientY - centerY));
    setRightJoyOffset({ x: dx, y: dy });
    onTouchLook(dx / 45, dy / 45);
  };

  const handleRightTouchEnd = () => {
    setRightJoyActive(false);
    setRightJoyOffset({ x: 0, y: 0 });
    onTouchLook(0, 0);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between font-mono text-white select-none">
      {/* Top Header Bar */}
      <div className="pointer-events-auto flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          <span className="rounded bg-sky-900/60 px-2.5 py-1 text-xs font-bold tracking-widest text-sky-300 border border-sky-600/40">
            SPACE SIMULATOR 2.0
          </span>
          <span className="text-xs text-gray-400">
            TIER: <strong className="text-sky-400">{qualityTier}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {gameState === 'ASCENT_CINEMATIC' && (
            <button
              onClick={onSkipCutscene}
              className="rounded bg-sky-600/80 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:bg-sky-500 active:scale-95"
            >
              SKIP CUTSCENE [S]
            </button>
          )}

          {gameState === 'ISS_EXPLORATION' && (
            <button
              onClick={onToggleFlashlight}
              className="rounded bg-slate-800/90 px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/40 hover:bg-slate-700 active:scale-95"
            >
              FLASHLIGHT [F]
            </button>
          )}

          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="rounded bg-slate-800/80 p-2 text-xs text-gray-300 border border-slate-700 hover:bg-slate-700 active:scale-95"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={onOpenSettings}
            className="rounded bg-slate-800/80 px-3 py-1.5 text-xs text-gray-300 border border-slate-700 hover:bg-slate-700 active:scale-95"
          >
            SETTINGS
          </button>
        </div>
      </div>

      {/* Main Menu State Overlay */}
      {gameState === 'IDLE_MENU' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-6 text-center backdrop-blur-sm">
          <div className="mb-2 text-xs tracking-widest text-sky-400">NASA &bull; COMMERCIAL CREW PROGRAM</div>
          <h1 className="mb-2 text-4xl font-extrabold tracking-wider text-white md:text-5xl drop-shadow-lg">
            SPACE SIMULATOR
          </h1>
          <p className="mb-8 text-sm text-slate-300 tracking-wide">
            EARTH TO INTERNATIONAL SPACE STATION JOURNEY
          </p>

          <div className="flex w-full max-w-xs flex-col space-y-3">
            <button
              onClick={onStartMission}
              className="rounded-lg bg-sky-600 py-3.5 text-sm font-bold tracking-wider text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-500 active:scale-95"
            >
              START MISSION
            </button>

            {progress.lastCheckpoint !== 'CHECKPOINT_LAUNCH' && onResumeCheckpoint && (
              <button
                onClick={onResumeCheckpoint}
                className="rounded-lg bg-slate-800 py-3 text-xs font-semibold tracking-wider text-emerald-400 border border-emerald-500/40 hover:bg-slate-700 active:scale-95"
              >
                RESUME: {progress.lastCheckpoint.replace('CHECKPOINT_', '')}
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="rounded-lg bg-slate-800/90 py-3 text-xs font-semibold tracking-wider text-gray-300 border border-slate-700 hover:bg-slate-700 active:scale-95"
            >
              SETTINGS & QUALITY
            </button>

            <button
              onClick={() => setShowCredits(true)}
              className="rounded-lg bg-slate-800/60 py-2.5 text-xs text-gray-400 border border-slate-800 hover:bg-slate-800 active:scale-95"
            >
              CREDITS & TECH SPECS
            </button>
          </div>
        </div>
      )}

      {/* Cupola Earth Observation Annotations */}
      {cupolaActive && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-12">
          <div className="flex justify-between items-start">
            <div className="rounded bg-sky-950/70 p-3 border border-sky-400/30 backdrop-blur-xs text-left">
              <div className="text-xs font-bold text-sky-300">OBSERVATION BAY // CUPOLA</div>
              <div className="text-[11px] text-gray-300">Target: Low Earth Orbit (408 km)</div>
              <div className="text-[10px] text-emerald-400">&bull; Inclination: 51.64° | Speed: 27,600 km/h</div>
            </div>

            <div className="rounded bg-sky-950/70 p-3 border border-sky-400/30 backdrop-blur-xs text-right">
              <div className="text-xs font-bold text-sky-300">ATMOSPHERE RIM</div>
              <div className="text-[11px] text-gray-300">Horizon Rayleigh Scattering Layer</div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="rounded-full bg-black/60 px-6 py-2 border border-sky-500/40 text-xs text-sky-200 tracking-wider">
              EARTH SURFACE &bull; DAY/NIGHT SOLAR TERMINATOR
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls Overlay */}
      {isTouchDevice && (gameState === 'DOCKING_MINIGAME' || gameState === 'ISS_EXPLORATION') && (
        <div className="pointer-events-auto flex w-full justify-between items-end p-6">
          {/* Left Virtual Joystick for Translation (Move) */}
          <div
            className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-800/60 border-2 ${
              leftJoyActive ? 'border-sky-400 ring-2 ring-sky-500/40' : 'border-sky-500/40'
            } touch-none shadow-lg`}
            onTouchStart={(e) => {
              setLeftJoyActive(true);
              handleLeftTouchMove(e);
            }}
            onTouchMove={handleLeftTouchMove}
            onTouchEnd={handleLeftTouchEnd}
          >
            <div className="text-[10px] text-gray-400 select-none">MOVE</div>
            <div
              className={`absolute h-12 w-12 rounded-full ${
                leftJoyActive ? 'bg-sky-400 scale-110' : 'bg-sky-500/80'
              } shadow-md transition-transform`}
              style={{
                transform: `translate(${leftJoyOffset.x}px, ${leftJoyOffset.y}px)`,
              }}
            />
          </div>

          {/* Center Action Buttons */}
          <div className="flex space-x-3 mb-2">
            <button
              onTouchStart={() => onTouchButtons(true, false, false)}
              onTouchEnd={() => onTouchButtons(false, false, false)}
              className="h-14 w-14 rounded-full bg-sky-600/80 text-xs font-bold text-white border border-sky-400/50 shadow-md active:bg-sky-400"
            >
              BOOST
            </button>
            <button
              onTouchStart={() => onTouchButtons(false, true, false)}
              onTouchEnd={() => onTouchButtons(false, false, false)}
              className="h-14 w-14 rounded-full bg-rose-600/80 text-xs font-bold text-white border border-rose-400/50 shadow-md active:bg-rose-400"
            >
              BRAKE
            </button>
            <button
              onTouchStart={() => onTouchButtons(false, false, true)}
              onTouchEnd={() => onTouchButtons(false, false, false)}
              className="h-14 w-14 rounded-full bg-emerald-600/80 text-xs font-bold text-white border border-emerald-400/50 shadow-md active:bg-emerald-400"
            >
              ACT
            </button>
          </div>

          {/* Right Virtual Joystick for Rotation (Look) */}
          <div
            className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-800/60 border-2 ${
              rightJoyActive ? 'border-cyan-400 ring-2 ring-cyan-500/40' : 'border-sky-500/40'
            } touch-none shadow-lg`}
            onTouchStart={(e) => {
              setRightJoyActive(true);
              handleRightTouchMove(e);
            }}
            onTouchMove={handleRightTouchMove}
            onTouchEnd={handleRightTouchEnd}
          >
            <div className="text-[10px] text-gray-400 select-none">LOOK</div>
            <div
              className={`absolute h-12 w-12 rounded-full ${
                rightJoyActive ? 'bg-cyan-400 scale-110' : 'bg-cyan-500/80'
              } shadow-md transition-transform`}
              style={{
                transform: `translate(${rightJoyOffset.x}px, ${rightJoyOffset.y}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 border border-slate-700 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">SIMULATOR SETTINGS</h2>
              <button
                onClick={onCloseSettings}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Quality Tier */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold text-gray-300">
                GRAPHICS QUALITY TIER
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as QualityTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => onSetQualityTier(tier)}
                    className={`rounded py-2 text-xs font-bold transition ${
                      qualityTier === tier
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                HIGH: Full Post-process &amp; Particles &bull; LOW: Max FPS for mobile
              </p>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="mb-5 flex items-center justify-between border-t border-slate-800 pt-4">
              <div>
                <div className="text-xs font-semibold text-gray-300">REDUCED MOTION</div>
                <div className="text-[11px] text-gray-500">Disables camera shake &amp; motion blur</div>
              </div>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={onToggleReducedMotion}
                className="h-5 w-5 rounded border-slate-700 text-sky-600 focus:ring-sky-500"
              />
            </div>

            {/* Audio Volumes */}
            <div className="mb-6 space-y-3 border-t border-slate-800 pt-4">
              <div className="text-xs font-semibold text-gray-300">AUDIO VOLUMES</div>
              <div>
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>MASTER</span>
                  <span>{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) =>
                    onSetVolumes(Number(e.target.value), sfxVolume, voiceVolume, ambientVolume)
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>SFX &amp; ENGINES</span>
                  <span>{Math.round(sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={(e) =>
                    onSetVolumes(masterVolume, Number(e.target.value), voiceVolume, ambientVolume)
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                  <span>RADIO &amp; MISSION CONTROL</span>
                  <span>{Math.round(voiceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) =>
                    onSetVolumes(masterVolume, sfxVolume, Number(e.target.value), ambientVolume)
                  }
                  className="w-full accent-sky-500"
                />
              </div>
            </div>

            <button
              onClick={onCloseSettings}
              className="w-full rounded-lg bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-500"
            >
              APPLY &amp; CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 border border-slate-700 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-sky-400">CREDITS &amp; TECH</h3>
            <p className="mb-4 text-xs text-gray-300 leading-relaxed">
              <strong>Space Simulator: Earth to ISS Journey</strong> was architected for maximum immersion, zero-latency Web Audio procedural synthesis, and WebGPU/WebGL2 dynamic fallback rendering.
            </p>
            <ul className="mb-5 space-y-1.5 text-xs text-gray-400">
              <li>&bull; <strong>Core Engine:</strong> Babylon.js 9 + WebGPU/WebGL2</li>
              <li>&bull; <strong>Audio Engine:</strong> Web Audio API Procedural Synthesizer</li>
              <li>&bull; <strong>Physics:</strong> 6-Axis Docking &amp; Zero-G Inertia Model</li>
              <li>&bull; <strong>Station Model:</strong> International Space Station Modular 3D</li>
            </ul>
            <button
              onClick={() => setShowCredits(false)}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-700"
            >
              BACK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
