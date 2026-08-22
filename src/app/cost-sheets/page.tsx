'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Flat, Project } from '@/types';

export default function CostSheetsSelectorPage() {
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
      const { data } = await supabase
        .from('flats')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('block')
        .order('flat_no');
      if (data) {
        setFlats(data as Flat[]);
        setSelectedFlatId('');
      }
    }
    loadFlats();
  }, [selectedProjectId]);

  const selectedFlat = flats.find((f) => f.id === selectedFlatId);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Cost Sheets</h1>
        <Link href="/cost-sheets/history" className="text-blue-600 hover:underline text-sm">
          View Previous Cost Sheets →
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
            <select
              value={selectedFlatId}
              onChange={(e) => setSelectedFlatId(e.target.value)}
              className="border rounded-md px-3 py-2 w-full"
            >
              <option value="">-- Select a flat --</option>
              {flats.map((f) => (
                <option key={f.id} value={f.id}>
                  Block {f.block} - {f.flat_no} ({f.floor}, {f.facing})
                </option>
              ))}
            </select>
          </div>

          {selectedFlat && (
            <div className="border rounded-lg p-4 bg-gray-50 text-sm space-y-1">
              <p><span className="font-medium">Block:</span> {selectedFlat.block}</p>
              <p><span className="font-medium">Flat No:</span> {selectedFlat.flat_no}</p>
              <p><span className="font-medium">Floor:</span> {selectedFlat.floor}</p>
              <p><span className="font-medium">Facing:</span> {selectedFlat.facing}</p>
              <p><span className="font-medium">Super Built-up Area:</span> {selectedFlat.sba_sqft} sq.ft</p>
              <p><span className="font-medium">Undivided Land Share:</span> {selectedFlat.undivided_land_share_sqyd} sq.yd</p>
              <p><span className="font-medium">Status:</span> <span className="capitalize">{selectedFlat.status}</span></p>
            </div>
          )}

          <button
            disabled={!selectedFlatId}
            onClick={() => router.push(`/cost-sheets/new?flat_id=${selectedFlatId}`)}
            className="bg-blue-600 text-white px-5 py-2 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            Generate Cost Sheet
          </button>
        </div>
      )}
    </div>
  );
}
