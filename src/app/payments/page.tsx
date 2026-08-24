'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Flat, Project } from '@/types';
import { RequireAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

function SelectorContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [flats, setFlats] = useState<Flat[]>([]);
  const [selectedFlatId, setSelectedFlatId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from('projects').select('*').order('name');
      if (data) {
        setProjects(data as Project[]);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      }
      setLoading(false);
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadFlats() {
      const { data } = await supabase.from('flats').select('*').eq('project_id', selectedProjectId).order('block').order('flat_no');
      if (data) { setFlats(data as Flat[]); setSelectedFlatId(''); }
    }
    loadFlats();
  }, [selectedProjectId]);

  const selectedFlat = flats.find((f) => f.id === selectedFlatId);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-[#0F2444] mb-6">Payment Tracker</h1>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="bg-white border rounded-lg shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#1F3864]">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
              <select value={selectedFlatId} onChange={(e) => setSelectedFlatId(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#1F3864]">
                <option value="">-- Select a flat --</option>
                {flats.map((f) => (
                  <option key={f.id} value={f.id}>{f.block ? `Block ${f.block} - ` : ''}{f.flat_no} ({f.floor}, {f.facing})</option>
                ))}
              </select>
            </div>
            {selectedFlat && (
              <div className="border rounded-lg p-4 bg-slate-50 text-sm space-y-1">
                <p><span className="font-medium">Flat No:</span> {selectedFlat.flat_no}</p>
                <p><span className="font-medium">SBA:</span> {selectedFlat.sba_sqft} sq.ft</p>
              </div>
            )}
            <button
              disabled={!selectedFlatId}
              onClick={() => router.push(`/payments/new?flat_id=${selectedFlatId}`)}
              className="bg-[#1F3864] text-white px-5 py-2.5 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-[#16294B] font-medium w-full sm:w-auto">
              Start Payment Tracker
            </button>
            <p className="text-xs text-gray-400">
              If a frozen Cost Sheet exists for this flat, its Total Flat Cost will be pulled in automatically (still editable).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentsSelectorPage() {
  return (
    <RequireAuth>
      <SelectorContent />
    </RequireAuth>
  );
}
