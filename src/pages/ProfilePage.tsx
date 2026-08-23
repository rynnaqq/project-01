import { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { AVATARS, getAvatar } from '../lib/avatars';
import { updateAvatar } from '../lib/profile';

/** Profile page: avatar selection, badge display, online status. */
export default function ProfilePage() {
  const { session, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session || !profile) {
    // The session exists but the profile row could not be loaded (e.g. a
    // transient network failure). Offer a retry instead of spinning forever.
    return (
      <section className="mx-auto max-w-sm py-12 text-center">
        <h1 className="font-display text-lg uppercase tracking-wide">Profile</h1>
        <p role="alert" className="mt-3 text-sm font-semibold text-[#7c2d24]">
          We couldn't load your profile. Check your connection and try again.
        </p>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
          className="mt-5 cursor-pointer rounded-full border-[3px] border-arcade-ink bg-arcade-accent px-4 py-2 text-sm font-bold text-arcade-ink shadow-pop-sm transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </section>
    );
  }

  const current = getAvatar(profile.avatar);

  async function handleSelect(avatarId: string) {
    if (!session || avatarId === profile?.avatar) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await updateAvatar(session.user.id, avatarId);
    if (updateError) {
      setError(updateError);
    } else {
      await refreshProfile();
    }
    setSaving(false);
  }

  return (
    <section className="flex flex-col gap-8">
      <header className="slab flex -rotate-[0.5deg] items-center gap-4 p-6 shadow-pop">
        <div className="flex h-16 w-16 shrink-0 -rotate-3 items-center justify-center rounded-full border-[3px] border-arcade-ink bg-arcade-sun text-4xl shadow-pop-sm">
          {current.emoji}
        </div>
        <div>
          <h1 className="font-display text-base uppercase tracking-wide">{profile.username}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium">
            <span
              className={`inline-block h-3 w-3 rounded-full border-2 border-arcade-ink ${
                profile.online_status ? 'bg-arcade-neon' : 'bg-stone-400'
              }`}
              aria-hidden
            />
            <span className="text-stone-600">
              {profile.online_status ? 'Online' : 'Offline'}
            </span>
          </div>
          {profile.badge && (
            <span className="sticker mt-2 rotate-1 bg-arcade-pop px-3 py-0.5 text-xs normal-case text-arcade-ink">
              {profile.badge}
            </span>
          )}
        </div>
      </header>

      <div>
        <h2 className="mb-4 font-display text-base uppercase tracking-wide">Choose your avatar</h2>
        {error && (
          <p role="alert" className="mb-3 text-sm font-semibold text-[#7c2d24]">
            {error}
          </p>
        )}
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-6">
          {AVATARS.map((avatar) => {
            const selected = avatar.id === profile.avatar;
            return (
              <button
                key={avatar.id}
                type="button"
                disabled={saving}
                onClick={() => handleSelect(avatar.id)}
                title={avatar.label}
                aria-pressed={selected}
                aria-label={avatar.label}
                className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border-[3px] border-arcade-ink text-3xl transition-[background-color,transform] duration-200 ${
                  selected
                    ? 'rotate-3 bg-arcade-sun shadow-pop'
                    : 'bg-arcade-panel hover:-translate-y-0.5 hover:bg-arcade-muted'
                }`}
              >
                {avatar.emoji}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
