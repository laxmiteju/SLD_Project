'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';

export default function AppHeader() {
  const { signOut } = useAuth();

  function handleSignOut() {
    if (confirm('Sign out?')) signOut();
  }

  return (
    <div className="bg-[#0F2444] text-white">
      <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-md p-1.5 flex items-center justify-center">
            <Image src="/sld-logo.png" alt="Sree Laxmi Developers" width={32} height={31} />
          </div>
          <div>
            <p className="font-bold tracking-wide text-sm leading-tight">SREE LAXMI DEVELOPERS</p>
            <p className="text-xs text-blue-200 leading-tight">Cost Sheet Generator</p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <Link href="/cost-sheets/history" className="text-blue-200 hover:text-white hover:underline">
            Previous Sheets →
          </Link>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-blue-200 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
