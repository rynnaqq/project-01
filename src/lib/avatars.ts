/** Preset avatar catalog. Avatar ids are stored in `profiles.avatar`. */
export type Avatar = { id: string; label: string; art: string };

export const AVATARS: Avatar[] = [
  { id: 'avatar-01', label: 'Robot', art: 'robot' },
  { id: 'avatar-02', label: 'Alien', art: 'alien' },
  { id: 'avatar-03', label: 'Ghost', art: 'ghost' },
  { id: 'avatar-04', label: 'Cat', art: 'cat' },
  { id: 'avatar-05', label: 'Fox', art: 'fox' },
  { id: 'avatar-06', label: 'Dragon', art: 'dragon' },
  { id: 'avatar-07', label: 'Wizard', art: 'wizard' },
  { id: 'avatar-08', label: 'Ninja', art: 'ninja' },
  { id: 'avatar-09', label: 'Rocket', art: 'rocket' },
  { id: 'avatar-10', label: 'Star', art: 'star' },
  { id: 'avatar-11', label: 'Fire', art: 'fire' },
  { id: 'avatar-12', label: 'Skull', art: 'skull' },
];

const DEFAULT_AVATAR = AVATARS[0];

/** Resolve an avatar id to its catalog entry, falling back to the default. */
export function getAvatar(id: string | null | undefined): Avatar {
  return AVATARS.find((a) => a.id === id) ?? DEFAULT_AVATAR;
}
