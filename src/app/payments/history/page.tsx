'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { RequireAuth, useAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

interface Row {
  id: string;
  customer_name: string | null;
  flat_no: string;
  block: string | null;
  tracker_date: string;
  status: string;
  project_name: string;
  totalPayable: number;
  totalReceived: number;
  balance: number;
}

function HistoryContent() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase.from('payment_trackers').select('*, flats(flat_no, block), projects(name)').order('created_at', { ascending: false });
    if (!error && data) {
      setRows(data.map((t: any) => {
        const totalFlatCost = (t.flat_cost_items ?? []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
        const totalPayable = totalFlatCost + (t.payable_adjustments ?? []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
        const totalReceived = (t.payments_received ?? []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
        return {
          id: t.id, customer_name: t.customer_name, flat_no: t.flats?.flat_no ?? '-', block: t.flats?.block ?? null,
          tracker_date: t.tracker_date, status: t.status, project_name: t.projects?.name ?? '-',
          totalPayable, totalReceived, balance: totalPayable - totalReceived,
        };
      }));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(row: Row) {
    const msg = row.status === 'completed'
      ? `This tracker for ${row.customer_name || 'this customer'} is COMPLETED. Delete permanently?`
      : `Delete this payment tracker for ${row.customer_name || 'this customer'}?`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from('payment_trackers').delete().eq('id', row.id);
    if (error) {
      alert('Could not delete: ' + error.message + (row.status === 'completed' ? ' (only admins can delete completed trackers)' : ''));
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#0F2444]">Payment Trackers</h1>
          <Link href="/payments" className="text-blue-600 hover:underline text-sm">+ New Tracker</Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500">No payment trackers created yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Project</th>
                  <th className="px-4 py-2">Flat</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Payable</th>
                  <th className="px-4 py-2 text-right">Received</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const canDelete = r.status === 'active' || role === 'admin';
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{r.customer_name || '(unnamed)'}</td>
                      <td className="px-4 py-2">{r.project_name}</td>
                      <td className="px-4 py-2">{r.block ? `${r.block}-${r.flat_no}` : r.flat_no}</td>
                      <td className="px-4 py-2">{r.tracker_date}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(r.totalPayable)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(r.totalReceived)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(r.balance)}</td>
                      <td className="px-4 py-2">
                        <span className={r.status === 'completed' ? 'bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full' : 'bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full'}>
                          {r.status === 'completed' ? 'Completed' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/payments/${r.id}`} className="text-blue-600 hover:underline">{r.status === 'completed' ? 'View' : 'Edit'}</Link>
                      </td>
                      <td className="px-4 py-2">
                        {canDelete ? (
                          <button onClick={() => handleDelete(r)} className="text-red-500 hover:underline text-xs">Delete</button>
                        ) : (
                          <span className="text-gray-300 text-xs" title="Only an admin can delete a completed tracker">Delete</span>
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

export default function PaymentsHistoryPage() {
  return (
    <RequireAuth>
      <HistoryContent />
    </RequireAuth>
  );
}
