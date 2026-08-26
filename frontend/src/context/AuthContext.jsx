import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";
import { getPrimaryWorkspace, getProfile, listDevices } from "../services/backend";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");

  const hydrateUser = useCallback(async (activeSession) => {
    setSession(activeSession || null);
    setBackendError("");

    if (!activeSession?.user) {
      setProfile(null);
      setWorkspace(null);
      setDeviceCount(0);
      setLoading(false);
      return;
    }

    try {
      const [nextProfile, nextWorkspace] = await Promise.all([
        getProfile(activeSession.user.id),
        getPrimaryWorkspace(),
      ]);
      setProfile(nextProfile);
      setWorkspace(nextWorkspace);
      if (nextWorkspace?.id) {
        const devices = await listDevices(nextWorkspace.id);
        setDeviceCount(devices.length);
      } else {
        setDeviceCount(0);
      }
    } catch (error) {
      setBackendError(error.message || "Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    await hydrateUser(session);
  }, [hydrateUser, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    const supabase = requireSupabase();
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setBackendError(error.message);
        setLoading(false);
        return;
      }
      hydrateUser(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => hydrateUser(nextSession), 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateUser]);

  const signIn = useCallback(async ({ email, password }) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async ({ fullName, email, password }) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/app/overview`,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app/overview` },
    });
    if (error) throw error;
    return data;
  }, []);

  const resetPassword = useCallback(async (email) => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/login`,
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      workspace,
      deviceCount,
      loading,
      backendError,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut,
      refreshWorkspace,
    }),
    [
      backendError,
      deviceCount,
      loading,
      profile,
      refreshWorkspace,
      resetPassword,
      session,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      workspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
