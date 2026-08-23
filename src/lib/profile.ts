import { supabase } from './supabase';

/** Update the current user's avatar. */
export async function updateAvatar(userId: string, avatarId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar: avatarId })
    .eq('id', userId);
  return error ? { error: error.message } : {};
}

/**
 * Set the current user's online status.
 *
 * NOTE: This writes the persisted flag only. Realtime presence-driven status
 * is wired in P2.2; for now this is a manual/stub setter.
 */
export async function setOnlineStatus(
  userId: string,
  online: boolean,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ online_status: online })
    .eq('id', userId);
  return error ? { error: error.message } : {};
}
