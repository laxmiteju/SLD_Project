'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, calculateCostSheet } from '@/lib/utils';

interface SheetRow {
  id: string;
  customer_name: string | null;
  sheet_date: string;
  status: string;
  flat_no: string;
  block: string | null;
  project_name: string;
  total: number;
}

export default function CostSheetHistoryPage() {
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('cost_sheets')
        .select('*, flats(flat_no, block), projects(name)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: SheetRow[] = data.map((s: any) => {
          const totals = calculateCostSheet(s);
          return {
            id: s.id,
            customer_name: s.customer_name,
            sheet_date: s.sheet_date,
            status: s.status,
            flat_no: s.flats?.flat_no ?? '-',
            block: s.flats?.block ?? null,
            project_name: s.projects?.name ?? '-',
            total: totals.totalFlatCost,
          };
        });
        setRows(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Previous Cost Sheets</h1>
        <Link href="/cost-sheets" className="text-blue-600 hover:underline text-sm">
          + New Cost Sheet
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No cost sheets created yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Flat</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{r.customer_name || '(unnamed)'}</td>
                  <td className="px-4 py-2">{r.project_name}</td>
                  <td className="px-4 py-2">{r.block}-{r.flat_no}</td>
                  <td className="px-4 py-2">{r.sheet_date}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-2">
                    <span className={
                      r.status === 'final'
                        ? 'bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full'
                        : 'bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full'
                    }>
                      {r.status === 'final' ? 'Finalized' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/cost-sheets/${r.id}`} className="text-blue-600 hover:underline">
                      {r.status === 'final' ? 'View' : 'Edit'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
