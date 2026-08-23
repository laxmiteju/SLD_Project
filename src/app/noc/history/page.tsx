'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { RequireAuth, useAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

interface Row {
  id: string;
  customer_name: string | null;
  flat_no: string;
  block: string | null;
  noc_date: string;
  status: string;
  project_name: string;
}

function HistoryContent() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase.from('noc_letters').select('*, projects(name)').order('created_at', { ascending: false });
    if (!error && data) {
      setRows(data.map((n: any) => ({
        id: n.id, customer_name: n.customer_name, flat_no: n.flat_no, block: n.block,
        noc_date: n.noc_date, status: n.status, project_name: n.projects?.name ?? '-',
      })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(row: Row) {
    const msg = row.status === 'final'
      ? `This is a FINALIZED NOC for ${row.customer_name || 'this customer'}. Delete permanently?`
      : `Delete this draft NOC for ${row.customer_name || 'this customer'}?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from('noc_letters').delete().eq('id', row.id);
    if (error) {
      alert('Could not delete: ' + error.message + (row.status === 'final' ? ' (only admins can delete finalized NOCs)' : ''));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#0F2444]">Previous NOCs</h1>
          <Link href="/noc" className="text-blue-600 hover:underline text-sm">+ New NOC</Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500">No NOCs created yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Project</th>
                  <th className="px-4 py-2">Flat</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canDelete = r.status === 'draft' || role === 'admin';
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{r.customer_name || '(unnamed)'}</td>
                      <td className="px-4 py-2">{r.project_name}</td>
                      <td className="px-4 py-2">{r.block ? `${r.block}-${r.flat_no}` : r.flat_no}</td>
                      <td className="px-4 py-2">{r.noc_date}</td>
                      <td className="px-4 py-2">
                        <span className={r.status === 'final' ? 'bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full' : 'bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full'}>
                          {r.status === 'final' ? 'Finalized' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/noc/${r.id}`} className="text-blue-600 hover:underline">{r.status === 'final' ? 'View' : 'Edit'}</Link>
                      </td>
                      <td className="px-4 py-2">
                        {canDelete ? (
                          <button onClick={() => handleDelete(r)} className="text-red-500 hover:underline text-xs">Delete</button>
                        ) : (
                          <span className="text-gray-300 text-xs" title="Only an admin can delete a finalized NOC">Delete</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NocHistoryPage() {
  return (
    <RequireAuth>
      <HistoryContent />
    </RequireAuth>
  );
}
