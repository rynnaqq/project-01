import React, { useState } from 'react';
import type { QualityTier } from '../core/qualityManager';
import type { MissionProgress } from '../core/progressManager';
import type { CheckpointId } from '../core/progressManager';

// We import some generic game styles/components

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
  dockingState?: any; // To pass docking telemetry to React UI
  
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
  dockingState,
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
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
  );

  // Touch joystick tracking
  const [leftJoyActive, setLeftJoyActive] = useState(false);
  const [leftJoyOffset, setLeftJoyOffset] = useState({ x: 0, y: 0 });
  const [rightJoyActive, setRightJoyActive] = useState(false);
  const [rightJoyOffset, setRightJoyOffset] = useState({ x: 0, y: 0 });

  const JOYSTICK_MAX_RADIUS = 40;

  const handleLeftTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate raw distance and angle
    const rawDx = touch.clientX - centerX;
    const rawDy = touch.clientY - centerY;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    
    // Clamp to max radius
    let dx = rawDx;
    let dy = rawDy;
    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (rawDx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (rawDy / dist) * JOYSTICK_MAX_RADIUS;
    }
    
    setLeftJoyOffset({ x: dx, y: dy });
    // Invert Y for forward/backward movement, X for strafe
    onTouchMove(dx / JOYSTICK_MAX_RADIUS, 0, -dy / JOYSTICK_MAX_RADIUS);
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
    
    const rawDx = touch.clientX - centerX;
    const rawDy = touch.clientY - centerY;
    const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    
    let dx = rawDx;
    let dy = rawDy;
    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (rawDx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (rawDy / dist) * JOYSTICK_MAX_RADIUS;
    }
    
    setRightJoyOffset({ x: dx, y: dy });
    onTouchLook(dx / JOYSTICK_MAX_RADIUS, dy / JOYSTICK_MAX_RADIUS);
  };

  const handleRightTouchEnd = () => {
    setRightJoyActive(false);
    setRightJoyOffset({ x: 0, y: 0 });
    onTouchLook(0, 0);
  };

  const getCheckpointName = (id: CheckpointId | null) => {
    if (!id) return '';
    const nameMap: Record<string, string> = {
      'CHECKPOINT_LAUNCH': 'LAUNCH PAD',
      'CHECKPOINT_ASCENT': 'ASCENT',
      'CHECKPOINT_ORBIT': 'ORBIT INSERTION',
      'CHECKPOINT_DOCKING': 'DOCKING APPROACH',
      'CHECKPOINT_ISS': 'ISS INTERIOR'
    };
    return nameMap[id] || id;
  };

  // Convert Memphis theme classes to the UI
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between font-body select-none overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="pointer-events-auto flex items-start justify-between p-3 md:p-5">
        <div className="flex flex-col gap-1">
          <div className="sticker bg-arcade-ink px-3 py-1 text-[10px] font-bold tracking-widest text-white shadow-pop-sm flex items-center gap-1.5 w-max rounded-full border-2 border-arcade-ink">
            <span className="w-2 h-2 rounded-full bg-arcade-pop animate-pulse" />
            SPACE SIMULATOR
          </div>
          {gameState !== 'IDLE_MENU' && (
            <div className="sticker bg-white/90 px-3 py-0.5 text-[10px] font-bold text-arcade-ink w-max border-2 border-arcade-ink rounded-full shadow-pop-sm">
              MISSION: {getCheckpointName(progress.lastCheckpoint)}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {gameState === 'ASCENT_CINEMATIC' && (
            <button
              onClick={onSkipCutscene}
              className="lift rounded-full border-[3px] border-arcade-ink bg-arcade-sea px-4 py-1.5 text-xs font-bold text-arcade-ink shadow-pop-sm transition-colors hover:bg-sky-300"
            >
              SKIP
            </button>
          )}

          {gameState === 'ISS_EXPLORATION' && (
            <button
              onClick={onToggleFlashlight}
              className="lift rounded-full border-[3px] border-arcade-ink bg-arcade-sun px-3 py-1.5 text-xs font-bold text-arcade-ink shadow-pop-sm transition-colors hover:bg-yellow-300"
            >
              FLASHLIGHT
            </button>
          )}

          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="lift flex items-center justify-center h-10 w-10 rounded-full border-[3px] border-arcade-ink bg-white shadow-pop-sm transition-colors hover:bg-gray-100"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={onOpenSettings}
            className="lift flex items-center justify-center h-10 w-10 rounded-full border-[3px] border-arcade-ink bg-arcade-panel shadow-pop-sm transition-colors hover:bg-gray-200"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Menu State Overlay */}
      {gameState === 'IDLE_MENU' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-arcade-ink/80 p-6 text-center backdrop-blur-sm z-40">
          <div className="slab p-8 max-w-sm w-full flex flex-col items-center shadow-pop-lg transform -rotate-1">
            <div className="mb-2 text-xs font-bold tracking-widest text-arcade-peri bg-arcade-peri/10 px-3 py-1 rounded-full border border-arcade-peri">NASA CREW DRAGON</div>
            <h1 className="mb-2 text-3xl font-display uppercase tracking-wide text-arcade-ink">
              Space Simulator
            </h1>
            <p className="mb-8 text-sm font-medium text-stone-600">
              Earth to ISS Journey. Launch, manage trajectory, and manually dock your capsule.
            </p>

            <div className="flex w-full flex-col space-y-3">
              <button
                onClick={onStartMission}
                className="lift block w-full rounded-full border-[3px] border-arcade-ink bg-arcade-sea px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors hover:bg-[#40e0d0]"
              >
                START MISSION
              </button>

              {progress.lastCheckpoint && progress.lastCheckpoint !== 'CHECKPOINT_LAUNCH' && onResumeCheckpoint && (
                <button
                  onClick={onResumeCheckpoint}
                  className="lift block w-full rounded-full border-[3px] border-arcade-ink bg-arcade-sun px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors hover:bg-yellow-400"
                >
                  RESUME: {getCheckpointName(progress.lastCheckpoint)}
                </button>
              )}

              <button
                onClick={onOpenSettings}
                className="lift block w-full rounded-full border-[3px] border-arcade-ink bg-arcade-panel px-6 py-3 font-bold text-arcade-ink shadow-pop transition-colors hover:bg-gray-100"
              >
                SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docking Telemetry Overlay (React Based) */}
      {gameState === 'DOCKING_MINIGAME' && dockingState && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex flex-col items-center">
          <div className="slab bg-white/90 p-3 max-w-xs w-full shadow-pop flex flex-col gap-2 border-[3px] border-arcade-ink rounded-xl">
             <div className="flex justify-between items-center border-b-2 border-arcade-ink/10 pb-1">
               <span className="text-xs font-bold text-arcade-ink">DOCKING TELEMETRY</span>
               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-arcade-ink ${dockingState.status === 'READY' ? 'bg-arcade-sea text-arcade-ink' : dockingState.status === 'WARNING' ? 'bg-arcade-sun text-arcade-ink' : 'bg-arcade-pop text-white'}`}>
                 {dockingState.status}
               </span>
             </div>
             <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-medium text-stone-700">
               <div>Dist: <span className="font-bold text-arcade-ink">{dockingState.distance.toFixed(1)}m</span></div>
               <div>Speed: <span className="font-bold text-arcade-ink">{dockingState.speed.toFixed(2)}m/s</span></div>
               <div>X-Err: <span className="font-bold text-arcade-ink">{dockingState.offset.x.toFixed(2)}m</span></div>
               <div>Y-Err: <span className="font-bold text-arcade-ink">{dockingState.offset.y.toFixed(2)}m</span></div>
               <div>Yaw: <span className="font-bold text-arcade-ink">{dockingState.angle.yaw.toFixed(1)}°</span></div>
               <div>Pitch: <span className="font-bold text-arcade-ink">{dockingState.angle.pitch.toFixed(1)}°</span></div>
             </div>
          </div>
          
          {/* Docking Messages */}
          {dockingState.message && (
             <div className="mt-4 text-center">
               <span className="bg-arcade-ink text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-pop-sm border-[3px] border-arcade-ink animate-pulse">
                 {dockingState.message}
               </span>
             </div>
          )}
        </div>
      )}

      {/* Cupola Earth Observation Annotations */}
      {cupolaActive && (
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 md:p-12 z-20">
          <div className="flex justify-between items-start mt-16 md:mt-0">
            <div className="slab bg-white/90 p-3 shadow-pop border-[3px] border-arcade-ink text-left rounded-xl rotate-1">
              <div className="text-xs font-display text-arcade-pop">CUPOLA OBSERVATION</div>
              <div className="text-[11px] font-bold text-arcade-ink mt-1">Target: Low Earth Orbit (408 km)</div>
              <div className="text-[10px] font-medium text-stone-600">Inc: 51.64° | Spd: 27,600 km/h</div>
            </div>
          </div>
          <div className="flex justify-center mb-24 md:mb-12">
            <div className="sticker bg-arcade-sea px-6 py-2 border-2 border-arcade-ink font-bold text-xs text-arcade-ink shadow-pop-sm">
              EARTH SURFACE &bull; SOLAR TERMINATOR
            </div>
          </div>
        </div>
      )}

      {/* Mobile Touch Controls Overlay */}
      {isTouchDevice && (gameState === 'DOCKING_MINIGAME' || gameState === 'ISS_EXPLORATION') && (
        <div className="pointer-events-auto flex w-full justify-between items-end p-4 md:p-8 pb-8 z-40">
          {/* Left Virtual Joystick for Translation (Move) */}
          <div
            className={`relative flex h-28 w-28 md:h-32 md:w-32 items-center justify-center rounded-full bg-white/80 border-[3px] ${
              leftJoyActive ? 'border-arcade-pop shadow-pop-sm' : 'border-arcade-ink'
            } touch-none`}
            onTouchStart={(e) => {
              setLeftJoyActive(true);
              handleLeftTouchMove(e);
            }}
            onTouchMove={handleLeftTouchMove}
            onTouchEnd={handleLeftTouchEnd}
            onTouchCancel={handleLeftTouchEnd}
          >
            <div className="text-[10px] font-bold text-arcade-ink/40 select-none">MOVE</div>
            <div
              className={`absolute h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-arcade-ink ${
                leftJoyActive ? 'bg-arcade-pop' : 'bg-stone-300'
              } transition-colors`}
              style={{
                transform: `translate(${leftJoyOffset.x}px, ${leftJoyOffset.y}px)`,
              }}
            />
          </div>

          {/* Center Action Buttons */}
          <div className="flex flex-col md:flex-row gap-3 mb-2 items-center">
            <div className="flex gap-3">
              <button
                onTouchStart={() => onTouchButtons(true, false, false)}
                onTouchEnd={() => onTouchButtons(false, false, false)}
                onTouchCancel={() => onTouchButtons(false, false, false)}
                className="lift flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-arcade-sun text-[10px] md:text-xs font-bold text-arcade-ink border-[3px] border-arcade-ink shadow-pop active:shadow-none active:translate-y-1"
              >
                FWD
              </button>
              <button
                onTouchStart={() => onTouchButtons(false, true, false)}
                onTouchEnd={() => onTouchButtons(false, false, false)}
                onTouchCancel={() => onTouchButtons(false, false, false)}
                className="lift flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-arcade-pop text-[10px] md:text-xs font-bold text-white border-[3px] border-arcade-ink shadow-pop active:shadow-none active:translate-y-1"
              >
                BACK
              </button>
            </div>
            {(gameState === 'DOCKING_MINIGAME' || cupolaActive) && (
              <button
                onTouchStart={() => onTouchButtons(false, false, true)}
                onTouchEnd={() => onTouchButtons(false, false, false)}
                onTouchCancel={() => onTouchButtons(false, false, false)}
                className="lift flex h-14 px-4 md:h-16 items-center justify-center rounded-full bg-arcade-sea text-[10px] md:text-xs font-bold text-arcade-ink border-[3px] border-arcade-ink shadow-pop active:shadow-none active:translate-y-1"
              >
                {gameState === 'DOCKING_MINIGAME' ? 'DOCK' : 'INTERACT'}
              </button>
            )}
          </div>

          {/* Right Virtual Joystick for Rotation (Look) */}
          <div
            className={`relative flex h-28 w-28 md:h-32 md:w-32 items-center justify-center rounded-full bg-white/80 border-[3px] ${
              rightJoyActive ? 'border-arcade-sea shadow-pop-sm' : 'border-arcade-ink'
            } touch-none`}
            onTouchStart={(e) => {
              setRightJoyActive(true);
              handleRightTouchMove(e);
            }}
            onTouchMove={handleRightTouchMove}
            onTouchEnd={handleRightTouchEnd}
            onTouchCancel={handleRightTouchEnd}
          >
            <div className="text-[10px] font-bold text-arcade-ink/40 select-none">LOOK</div>
            <div
              className={`absolute h-10 w-10 md:h-12 md:w-12 rounded-full border-2 border-arcade-ink ${
                rightJoyActive ? 'bg-arcade-sea' : 'bg-stone-300'
              } transition-colors`}
              style={{
                transform: `translate(${rightJoyOffset.x}px, ${rightJoyOffset.y}px)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-arcade-ink/80 p-4 backdrop-blur-sm">
          <div className="slab w-full max-w-md p-6 shadow-pop-lg transform rotate-1">
            <div className="mb-4 flex items-center justify-between border-b-[3px] border-arcade-ink pb-3">
              <h2 className="text-xl font-display uppercase text-arcade-ink">Settings</h2>
              <button
                onClick={onCloseSettings}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-arcade-ink bg-arcade-pop text-white font-bold lift"
              >
                ✕
              </button>
            </div>

            {/* Quality Tier */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-bold uppercase text-arcade-ink">
                Graphics Quality
              </label>
              <div className="flex gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as QualityTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => onSetQualityTier(tier)}
                    className={`lift flex-1 rounded-xl border-[3px] border-arcade-ink py-2 text-xs font-bold transition ${
                      qualityTier === tier
                        ? 'bg-arcade-sea text-arcade-ink shadow-pop-sm'
                        : 'bg-white text-stone-500'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="mb-5 flex items-center justify-between border-t-2 border-arcade-ink/10 pt-4">
              <div>
                <div className="text-sm font-bold text-arcade-ink">Reduced Motion</div>
                <div className="text-xs font-medium text-stone-500">Disables camera shake</div>
              </div>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={onToggleReducedMotion}
                className="h-6 w-6 rounded-md border-2 border-arcade-ink text-arcade-pop focus:ring-arcade-pop"
              />
            </div>

            {/* Audio Volumes */}
            <div className="mb-6 space-y-4 border-t-2 border-arcade-ink/10 pt-4">
              <div className="text-sm font-bold text-arcade-ink">Volumes</div>
              {[
                { label: 'Master', value: masterVolume, set: (v: number) => onSetVolumes(v, sfxVolume, voiceVolume, ambientVolume) },
                { label: 'SFX', value: sfxVolume, set: (v: number) => onSetVolumes(masterVolume, v, voiceVolume, ambientVolume) },
                { label: 'Radio/Voice', value: voiceVolume, set: (v: number) => onSetVolumes(masterVolume, sfxVolume, v, ambientVolume) }
              ].map((vol) => (
                <div key={vol.label} className="flex items-center gap-4">
                  <span className="w-24 text-xs font-bold text-stone-600">{vol.label}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={vol.value}
                    onChange={(e) => vol.set(Number(e.target.value))}
                    className="h-2 w-full appearance-none rounded-full bg-stone-200 accent-arcade-sea"
                  />
                  <span className="w-10 text-right text-xs font-bold text-arcade-ink">{Math.round(vol.value * 100)}%</span>
                </div>
              ))}
            </div>

            <button
              onClick={onCloseSettings}
              className="lift w-full rounded-full border-[3px] border-arcade-ink bg-arcade-sun py-3 text-sm font-bold text-arcade-ink shadow-pop"
            >
              DONE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
