/** Preset avatar catalog. Avatar ids are stored in `profiles.avatar`. */
export type Avatar = { id: string; label: string; emoji: string };

export const AVATARS: Avatar[] = [
  { id: 'avatar-01', label: 'Robot', emoji: '🤖' },
  { id: 'avatar-02', label: 'Alien', emoji: '👾' },
  { id: 'avatar-03', label: 'Ghost', emoji: '👻' },
  { id: 'avatar-04', label: 'Cat', emoji: '🐱' },
  { id: 'avatar-05', label: 'Fox', emoji: '🦊' },
  { id: 'avatar-06', label: 'Dragon', emoji: '🐲' },
  { id: 'avatar-07', label: 'Wizard', emoji: '🧙' },
  { id: 'avatar-08', label: 'Ninja', emoji: '🥷' },
  { id: 'avatar-09', label: 'Rocket', emoji: '🚀' },
  { id: 'avatar-10', label: 'Star', emoji: '⭐' },
  { id: 'avatar-11', label: 'Fire', emoji: '🔥' },
  { id: 'avatar-12', label: 'Skull', emoji: '💀' },
];

const DEFAULT_AVATAR = AVATARS[0];

/** Resolve an avatar id to its catalog entry, falling back to the default. */
export function getAvatar(id: string | null | undefined): Avatar {
  return AVATARS.find((a) => a.id === id) ?? DEFAULT_AVATAR;
}
