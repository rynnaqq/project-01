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
        <h1 className="font-display text-lg uppercase tracking-tight">Profile</h1>
        <p role="alert" className="mt-3 text-sm text-red-300">
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
          className="mt-5 rounded-xl bg-arcade-primary px-4 py-2 text-sm font-bold text-arcade-ink transition hover:brightness-110 disabled:opacity-50"
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
      <header className="glass-chip flex items-center gap-4 rounded-2xl p-6">
        <div className="glass flex h-16 w-16 items-center justify-center rounded-full text-4xl">
          {current.emoji}
        </div>
        <div>
          <h1 className="font-display text-lg tracking-tight">{profile.username}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                profile.online_status
                  ? 'bg-arcade-primary shadow-[0_0_8px_rgba(65,242,184,0.7)]'
                  : 'bg-slate-500'
              }`}
              aria-hidden
            />
            <span className="text-slate-400">
              {profile.online_status ? 'Online' : 'Offline'}
            </span>
          </div>
          {profile.badge && (
            <span className="mt-2 inline-block rounded-full border border-arcade-gold/30 bg-arcade-gold/10 px-3 py-0.5 text-xs text-arcade-gold">
              {profile.badge}
            </span>
          )}
        </div>
      </header>

      <div>
        <h2 className="mb-3 font-display text-sm uppercase tracking-[0.2em] text-slate-400">
          Choose your avatar
        </h2>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
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
                className={`flex aspect-square items-center justify-center rounded-xl text-3xl transition-all disabled:opacity-50 ${
                  selected
                    ? 'bg-arcade-primary/10 ring-2 ring-arcade-primary/60 shadow-underglow-mint'
                    : 'glass-chip hover:bg-white/10'
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
