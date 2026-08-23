import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import {
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type AuthResult,
} from '../lib/auth';
import { setOnlineStatus } from '../lib/profile';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (username: string, password: string) => Promise<AuthResult>;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Failed to load profile:', error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileForSession = useCallback(async (nextSession: Session | null) => {
    if (nextSession?.user) {
      setProfile(await fetchProfile(nextSession.user.id));
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfileForSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfileForSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForSession]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      setProfile(await fetchProfile(session.user.id));
    }
  }, [session]);

  // Persist the profiles.online_status flag so the profile page reflects
  // login state even outside a room. Realtime presence remains the source of
  // truth for live "connected" dots inside rooms.
  const lastOnlineIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = session?.user.id ?? null;
    if (id === lastOnlineIdRef.current) return;
    const previous = lastOnlineIdRef.current;
    lastOnlineIdRef.current = id;
    if (id) {
      void setOnlineStatus(id, true);
    } else if (previous) {
      void setOnlineStatus(previous, false);
    }
  }, [session]);

  const handleSignOut = useCallback(async () => {
    const id = session?.user.id;
    if (id) await setOnlineStatus(id, false);
    await authSignOut();
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signUp: authSignUp,
      signIn: authSignIn,
      signOut: handleSignOut,
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
