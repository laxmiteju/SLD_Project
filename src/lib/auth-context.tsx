'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  role: 'admin' | 'staff' | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  userId: null,
  email: null,
  role: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);

  async function loadProfile(uid: string, userEmail: string | null) {
    setUserId(uid);
    setEmail(userEmail);
    const { data } = await supabase.from('profiles').select('role').eq('id', uid).single();
    setRole((data?.role as 'admin' | 'staff') ?? 'staff');
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? null);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email ?? null);
      } else {
        setUserId(null);
        setEmail(null);
        setRole(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ loading, userId, email, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Wrap any page's content with this to require login
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userId) {
      router.replace('/login');
    }
  }, [loading, userId, router]);

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!userId) return null;
  return <>{children}</>;
}
