'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/cost-sheets');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F2444] p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm space-y-5"
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <Image src="/sld-logo.png" alt="Sree Laxmi Developers" width={64} height={62} />
          <h1 className="text-lg font-bold text-[#0F2444] tracking-wide text-center">
            SREE LAXMI DEVELOPERS
          </h1>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#1F3864] focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1F3864] text-white w-full py-2.5 rounded-md hover:bg-[#16294B] transition-colors disabled:bg-gray-300 font-medium"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
