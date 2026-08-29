// space-sim/mission/types.ts
export type MissionState =
  | "MISSION_INIT" | "KSC_ESTABLISHING" | "LAUNCH_PREPARATION" | "CREW_PREPARATION"
  | "COUNTDOWN" | "ENGINE_IGNITION" | "LIFTOFF" | "ATMOSPHERIC_ASCENT" | "BOOSTER_PHASE"
  | "STAGE_TRANSITION" | "ORBITAL_INSERTION" | "ORBIT" | "ISS_REVEAL" | "ISS_APPROACH"
  | "DOCKING_SEQUENCE" | "DOCKING_COMPLETE" | "CREW_TRANSFER" | "ISS_INTERIOR_INTRO"
  | "PLAYER_CONTROL_ENABLED" | "ISS_EXPLORATION";

export const MISSION_STATES: readonly MissionState[] = [
  "MISSION_INIT", "KSC_ESTABLISHING", "LAUNCH_PREPARATION", "CREW_PREPARATION",
  "COUNTDOWN", "ENGINE_IGNITION", "LIFTOFF", "ATMOSPHERIC_ASCENT", "BOOSTER_PHASE",
  "STAGE_TRANSITION", "ORBITAL_INSERTION", "ORBIT", "ISS_REVEAL", "ISS_APPROACH",
  "DOCKING_SEQUENCE", "DOCKING_COMPLETE", "CREW_TRANSFER", "ISS_INTERIOR_INTRO",
  "PLAYER_CONTROL_ENABLED", "ISS_EXPLORATION",
];

export type CommandKind =
  | "ignite" | "liftoff" | "separateSrb" | "separateCore" | "orbitInsertion"
  | "dockContact" | "dockCapture" | "dockHard" | "openHatch" | "enterInterior" | "enablePlayer";

export type Command = { kind: CommandKind };
export interface CommsLine { speaker: string; text: string; style: "radio" | "pa" | "crew" }
export interface HudChange { met?: boolean; phase?: string; telemetry?: "off" | "docking"; progressStage?: 1 | 2 | 3 | 4 | 5 | 6; countdown?: boolean }
export interface FxCommand { smoke?: number; exposure?: number; shake?: number; glare?: number }

export interface MissionEvent {
  id: string; state: MissionState; at: number; duration?: number; shot?: string;
  action?: Command; comms?: CommsLine; hud?: HudChange; fx?: FxCommand;
  transition?: "cut" | "dip" | "crossfade";
}
