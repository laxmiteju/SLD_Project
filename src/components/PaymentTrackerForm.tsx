'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { LineItem, PaymentTracker, Flat, Project, CostSheet } from '@/types';
import { formatCurrency, calculateCostSheet } from '@/lib/utils';
import { useAuth, RequireAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

interface Props {
  mode: 'new' | 'existing';
  flatId?: string;
  trackerId?: string;
}

interface FormState {
  customer_name: string;
  subject_note: string;
  tracker_date: string;
  flat_cost_items: LineItem[];
  payable_adjustments: LineItem[];
  payments_received: LineItem[];
  cash_payments: LineItem[];
  cash_payments_note: string;
  status: 'active' | 'completed';
}

function newItem(label = ''): LineItem {
  return { id: crypto.randomUUID(), label, amount: 0 };
}

// Textarea that resizes to fit its content automatically — on every render
// (including initial load and print), not just while the user is typing.
function AutoGrowTextarea({
  value, onChange, disabled, placeholder, className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

function PaymentTrackerFormInner({ mode, flatId, trackerId }: Props) {
  const router = useRouter();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [recordId, setRecordId] = useState<string | null>(trackerId ?? null);
  const [costSheetId, setCostSheetId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    async function load() {
      if (mode === 'new' && flatId) {
        const { data: flatData } = await supabase.from('flats').select('*').eq('id', flatId).single();
        if (!flatData) { setLoading(false); return; }
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', flatData.project_id).single();
        setFlat(flatData as Flat);
        setProject(projectData as Project);

        // Try to find a frozen cost sheet for this flat to prefill individual line items
        const { data: sheetData } = await supabase
          .from('cost_sheets')
          .select('*')
          .eq('flat_id', flatId)
          .eq('status', 'final')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let initialItems: LineItem[] = [];
        let customerNameFromSheet = '';
        if (sheetData) {
          setCostSheetId(sheetData.id);
          const s = sheetData as CostSheet;
          customerNameFromSheet = s.customer_name ?? '';
          const totals = calculateCostSheet(s);

          initialItems.push({
            id: crypto.randomUUID(),
            label: 'Base Price (per Sq.ft x SBA)',
            amount: Math.round(s.base_rate_per_sqft * s.sba_sqft),
          });
          for (const item of s.charge_items ?? []) {
            const amount = item.rateFields.reduce((a, b) => a * (Number(b) || 0), 1);
            initialItems.push({
              id: crypto.randomUUID(),
              label: item.label || 'Additional Charge',
              amount: Math.round(amount),
            });
          }
          initialItems.push({
            id: crypto.randomUUID(),
            label: `GST (${s.gst_percent}%)`,
            amount: Math.round(totals.gstAmount),
          });
          initialItems.push({
            id: crypto.randomUUID(),
            label: `Stamp Duty + Registration (${s.stamp_duty_percent}%)`,
            amount: Math.round(totals.stampDutyAmount),
          });
        }

        const flatLabel = flatData.block ? `${flatData.block} ${flatData.flat_no}` : flatData.flat_no;
        setForm({
          customer_name: customerNameFromSheet,
          subject_note: `${flatLabel} (${flatData.sba_sqft} sft) Payment Details`,
          tracker_date: new Date().toISOString().slice(0, 10),
          flat_cost_items: initialItems,
          payable_adjustments: [],
          payments_received: [],
          cash_payments: [],
          cash_payments_note: '',
          status: 'active',
        });
      } else if (mode === 'existing' && trackerId) {
        const { data } = await supabase.from('payment_trackers').select('*').eq('id', trackerId).single();
        if (!data) { setLoading(false); return; }
        const { data: flatData } = await supabase.from('flats').select('*').eq('id', data.flat_id).single();
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', data.project_id).single();
        setFlat(flatData as Flat);
        setProject(projectData as Project);
        setCostSheetId(data.cost_sheet_id);
        const t = data as PaymentTracker;
        setForm({
          customer_name: t.customer_name ?? '',
          subject_note: t.subject_note,
          tracker_date: t.tracker_date,
          flat_cost_items: t.flat_cost_items ?? [],
          payable_adjustments: t.payable_adjustments ?? [],
          payments_received: t.payments_received ?? [],
          cash_payments: t.cash_payments ?? [],
          cash_payments_note: t.cash_payments_note ?? '',
          status: t.status,
        });
      }
      setLoading(false);
    }
    load();
  }, [mode, flatId, trackerId]);

  const isLocked = form?.status === 'completed';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form || isLocked) return;
    setForm({ ...form, [key]: value });
  }

  function sum(items: LineItem[]) {
    return items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!flat || !project || !form) return <div className="p-8 text-red-600">Could not load data.</div>;

  const totalFlatCost = sum(form.flat_cost_items);
  const totalPayable = totalFlatCost + sum(form.payable_adjustments);
  const totalReceived = sum(form.payments_received);
  const balance = totalPayable - totalReceived;
  const totalCashGiven = sum(form.cash_payments);

  async function saveTracker(forceComplete?: boolean) {
    if (!form || !flat || !project) return;
    setSaving(true);
    const newStatus: 'active' | 'completed' =
      forceComplete || (totalPayable > 0 && balance === 0) ? 'completed' : 'active';

    const payload = {
      flat_id: flat.id,
      project_id: project.id,
      cost_sheet_id: costSheetId,
      ...form,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (recordId) {
      const { error } = await supabase.from('payment_trackers').update(payload).eq('id', recordId);
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setForm({ ...form, status: newStatus });
    } else {
      const { data, error } = await supabase.from('payment_trackers').insert(payload).select().single();
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setRecordId(data.id);
      setForm({ ...form, status: newStatus });
      router.replace(`/payments/${data.id}`);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!recordId || !form) return;
    const msg = form.status === 'completed'
      ? 'This tracker is COMPLETED. Delete it permanently? This cannot be undone.'
      : 'Delete this payment tracker? This cannot be undone.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('payment_trackers').delete().eq('id', recordId);
    if (error) {
      alert('Could not delete: ' + error.message + (form.status === 'completed' ? ' (only admins can delete completed trackers)' : ''));
      return;
    }
    router.push('/payments/history');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="p-4 sm:p-8 max-w-3xl mx-auto print:max-w-none print:p-0">
        <div className="flex items-center justify-between mb-4 no-print">
          <h1 className="text-2xl font-semibold text-[#0F2444]">Payment Tracker</h1>
          <div className="flex items-center gap-3">
            {isLocked && <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">COMPLETED</span>}
            {!isLocked && balance === 0 && totalPayable > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">Balance is ₹0 — will auto-complete on save</span>
            )}
            <button onClick={() => window.print()} className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
              🖨️ Print / Download PDF
            </button>
          </div>
        </div>

        <div id="printable-sheet" className="page-sheet bg-white shadow-md mx-auto print:shadow-none max-w-[800px] text-[13px] leading-relaxed border-2 border-gray-800">
          <div className="flex items-center gap-3 border-b-2 border-gray-800 p-4">
            <Image src="/sld-logo.png" alt="Sree Laxmi Developers" width={44} height={42} />
            <h2 className="text-lg font-bold tracking-wide flex-1 text-center -ml-11">SREE LAXMI DEVELOPERS</h2>
          </div>

          <div className="p-8 sm:p-12 pt-4 sm:pt-4">
          <table className="w-full border-collapse mb-4">
            <tbody>
              <DRow label="Project:">{project.name}</DRow>
              <DRow label="Date:">
                <input type="date" disabled={isLocked} value={form.tracker_date}
                  onChange={(e) => update('tracker_date', e.target.value)}
                  className="border-0 focus:outline-none bg-transparent disabled:bg-transparent" />
              </DRow>
              <DRow label="Subject:">
                <input disabled={isLocked} value={form.subject_note} onChange={(e) => update('subject_note', e.target.value)}
                  className="border-0 w-full focus:outline-none bg-transparent disabled:bg-transparent" />
              </DRow>
              <DRow label="Customer Name:">
                <input disabled={isLocked} value={form.customer_name} placeholder="Enter customer name"
                  onChange={(e) => update('customer_name', e.target.value)}
                  className="border-0 w-full focus:outline-none bg-transparent disabled:bg-transparent" />
              </DRow>
            </tbody>
          </table>

          {/* Flat Cost Details + Payable Adjustments — one continuous table, like the source doc */}
          <CombinedFlatCostTable
            flatCostItems={form.flat_cost_items}
            onFlatCostChange={(items) => update('flat_cost_items', items)}
            payableAdjustments={form.payable_adjustments}
            onPayableChange={(items) => update('payable_adjustments', items)}
            locked={isLocked}
            totalFlatCost={totalFlatCost}
            totalPayable={totalPayable}
          />

          <div className="h-4"></div>

          <LineItemsSection
            title="Payment Details"
            items={form.payments_received}
            onChange={(items) => update('payments_received', items)}
            locked={isLocked}
            subtotalLabel="Total Received"
            subtotal={totalReceived}
          />
          <div className="flex justify-between font-bold border-t border-gray-800 py-1 mt-1">
            <span>Balance Amount</span>
            <span>{formatCurrency(balance)}</span>
          </div>

          <div className="h-6"></div>

          <h3 className="text-center font-bold border-y border-gray-800 py-1 mb-1">Cash Payments</h3>
          <LineItemsSection
            title="Description"
            items={form.cash_payments}
            onChange={(items) => update('cash_payments', items)}
            locked={isLocked}
            subtotalLabel="Total Cash given"
            subtotal={totalCashGiven}
            amountColLabel="Cash Given"
          />
          <div className="flex gap-2 mt-2 text-xs">
            <span className="font-semibold shrink-0">Note :</span>
            <textarea disabled={isLocked} value={form.cash_payments_note}
              onChange={(e) => update('cash_payments_note', e.target.value)}
              rows={2}
              className="border-0 focus:outline-none bg-transparent disabled:bg-transparent w-full resize-none"
              placeholder="e.g. cutting charge formula, exceptions, etc."
            />
          </div>
          </div>
        </div>

        {!isLocked && (
          <div className="flex gap-3 mt-4 no-print">
            <button onClick={() => saveTracker(false)} disabled={saving} className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { if (confirm('Mark this tracker as COMPLETED and lock it from further edits?')) saveTracker(true); }}
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
              {saving ? 'Saving...' : 'Mark Complete'}
            </button>
            {recordId && (
              <button onClick={handleDelete} className="border border-red-300 text-red-600 bg-white px-4 py-2 rounded-md hover:bg-red-50 text-sm ml-auto">
                Delete
              </button>
            )}
          </div>
        )}
        {isLocked && role === 'admin' && (
          <div className="flex mt-4 no-print">
            <button onClick={handleDelete} className="border border-red-300 text-red-600 bg-white px-4 py-2 rounded-md hover:bg-red-50 text-sm ml-auto">
              Delete (admin)
            </button>
          </div>
        )}

        <style jsx global>{`
          @media print {
            .no-print { display: none !important; }
            @page { size: A4; margin: 15mm; }
            input, textarea { color: #000 !important; }
            table { table-layout: fixed !important; width: 100% !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

interface RowHandlers {
  updateItem: (id: string, patch: Partial<LineItem>) => void;
  insertAt: (index: number) => void;
  removeItem: (id: string) => void;
  moveItem: (id: string, dir: -1 | 1) => void;
}

function makeHandlers(items: LineItem[], onChange: (items: LineItem[]) => void): RowHandlers {
  return {
    updateItem: (id, patch) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it))),
    insertAt: (index) => {
      const copy = [...items];
      copy.splice(index, 0, newItem());
      onChange(copy);
    },
    removeItem: (id) => onChange(items.filter((it) => it.id !== id)),
    moveItem: (id, dir) => {
      const idx = items.findIndex((it) => it.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= items.length) return;
      const copy = [...items];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      onChange(copy);
    },
  };
}

function CombinedRow({
  item, idx, listLength, hideSerial, locked, h,
}: {
  item: LineItem; idx: number; listLength: number; hideSerial?: boolean; locked: boolean; h: RowHandlers;
}) {
  return (
    <Fragment>
      <tr>
        <td className="border border-gray-500 px-2 py-1 text-center w-10">{hideSerial ? '' : idx + 1}</td>
        <td className="border border-gray-500 px-2 py-1">
          <AutoGrowTextarea disabled={locked} value={item.label} placeholder="Description"
            onChange={(e) => h.updateItem(item.id, { label: e.target.value })}
            className="border-0 w-full focus:outline-none bg-transparent disabled:bg-transparent resize-none overflow-hidden leading-snug" />
        </td>
        <td className="border border-gray-500 px-2 py-1 text-right w-28">
          <input type="number" disabled={locked} value={item.amount}
            onChange={(e) => h.updateItem(item.id, { amount: Number(e.target.value) })}
            className="border-0 w-full text-right focus:outline-none bg-transparent disabled:bg-transparent" />
        </td>
        <td className="border border-gray-500 px-1 py-1 no-print w-16">
          {!locked && (
            <div className="flex gap-1 text-xs justify-center">
              <button onClick={() => h.moveItem(item.id, -1)} disabled={idx === 0} className="disabled:opacity-30">↑</button>
              <button onClick={() => h.moveItem(item.id, 1)} disabled={idx === listLength - 1} className="disabled:opacity-30">↓</button>
              <button onClick={() => h.removeItem(item.id)} className="text-red-500">✕</button>
            </div>
          )}
        </td>
      </tr>
      {!locked && (
        <tr className="no-print">
          <td colSpan={4} className="px-2 py-0.5 bg-blue-50/50">
            <button onClick={() => h.insertAt(idx + 1)} className="text-blue-600 text-[11px] hover:underline">+ Insert row here</button>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function CombinedFlatCostTable({
  flatCostItems, onFlatCostChange, payableAdjustments, onPayableChange, locked, totalFlatCost, totalPayable,
}: {
  flatCostItems: LineItem[];
  onFlatCostChange: (items: LineItem[]) => void;
  payableAdjustments: LineItem[];
  onPayableChange: (items: LineItem[]) => void;
  locked: boolean;
  totalFlatCost: number;
  totalPayable: number;
}) {
  const flatH = makeHandlers(flatCostItems, onFlatCostChange);
  const payH = makeHandlers(payableAdjustments, onPayableChange);

  return (
    <table className="w-full border-collapse mb-1" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '8%' }} />
        <col style={{ width: '52%' }} />
        <col style={{ width: '25%' }} />
        <col style={{ width: '15%' }} className="no-print" />
      </colgroup>
      <thead>
        <tr className="text-xs">
          <th className="border border-gray-500 px-2 py-1">S.NO</th>
          <th className="border border-gray-500 px-2 py-1 text-left">Flat Cost Details</th>
          <th className="border border-gray-500 px-2 py-1">Amount</th>
          <th className="border border-gray-500 px-1 py-1 no-print"></th>
        </tr>
      </thead>
      <tbody>
        {!locked && (
          <tr className="no-print">
            <td colSpan={4} className="px-2 py-0.5">
              <button onClick={() => flatH.insertAt(0)} className="text-blue-600 text-[11px] hover:underline">+ Insert row at top</button>
            </td>
          </tr>
        )}
        {flatCostItems.map((item, idx) => (
          <CombinedRow key={item.id} item={item} idx={idx} listLength={flatCostItems.length} locked={locked} h={flatH} />
        ))}

        <tr className="font-bold bg-gray-50">
          <td className="border border-gray-500" colSpan={2}><div className="px-2 py-1 text-right">Total Flat Cost</div></td>
          <td className="border border-gray-500 px-2 py-1 text-right">{formatCurrency(totalFlatCost)}</td>
          <td className="border border-gray-500 no-print"></td>
        </tr>

        {!locked && (
          <tr className="no-print">
            <td colSpan={4} className="px-2 py-0.5">
              <button onClick={() => payH.insertAt(0)} className="text-blue-600 text-[11px] hover:underline">+ Insert adjustment row</button>
            </td>
          </tr>
        )}
        {payableAdjustments.map((item, idx) => (
          <CombinedRow key={item.id} item={item} idx={idx} listLength={payableAdjustments.length} locked={locked} h={payH} />
        ))}

        <tr className="font-bold bg-gray-50">
          <td className="border border-gray-500" colSpan={2}><div className="px-2 py-1 text-right">Total amount payable by the customer</div></td>
          <td className="border border-gray-500 px-2 py-1 text-right">{formatCurrency(totalPayable)}</td>
          <td className="border border-gray-500 no-print"></td>
        </tr>
      </tbody>
    </table>
  );
}

function LineItemsSection({
  title, items, onChange, locked, subtotalLabel, subtotal, noHeader, amountColLabel, hideSerial,
}: {
  title: string;
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  locked: boolean;
  subtotalLabel: string;
  subtotal: number;
  noHeader?: boolean;
  amountColLabel?: string;
  hideSerial?: boolean;
}) {
  function updateItem(id: string, patch: Partial<LineItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function insertAt(index: number) {
    const copy = [...items];
    copy.splice(index, 0, newItem());
    onChange(copy);
  }
  function removeItem(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function moveItem(id: string, dir: -1 | 1) {
    const idx = items.findIndex((it) => it.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    onChange(copy);
  }

  return (
    <table className="w-full border-collapse mb-1" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '8%' }} />
        <col style={{ width: '52%' }} />
        <col style={{ width: '25%' }} />
        <col style={{ width: '15%' }} className="no-print" />
      </colgroup>
      {!noHeader && (
        <thead>
          <tr className="text-xs">
            <th className="border border-gray-500 px-2 py-1 w-10">S.NO</th>
            <th className="border border-gray-500 px-2 py-1 text-left">{title || 'Description'}</th>
            <th className="border border-gray-500 px-2 py-1 w-28">{amountColLabel ?? 'Amount'}</th>
            <th className="border border-gray-500 px-1 py-1 w-16 no-print"></th>
          </tr>
        </thead>
      )}
      <tbody>
        {!locked && (
          <tr className="no-print">
            <td colSpan={4} className="px-2 py-0.5">
              <button onClick={() => insertAt(0)} className="text-blue-600 text-[11px] hover:underline">+ Insert row at top</button>
            </td>
          </tr>
        )}
        {items.map((item, idx) => (
          <Fragment key={item.id}>
            <tr>
              <td className="border border-gray-500 px-2 py-1 text-center">{hideSerial ? '' : idx + 1}</td>
              <td className="border border-gray-500 px-2 py-1">
                <AutoGrowTextarea disabled={locked} value={item.label} placeholder="Description"
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  className="border-0 w-full focus:outline-none bg-transparent disabled:bg-transparent resize-none overflow-hidden leading-snug" />
              </td>
              <td className="border border-gray-500 px-2 py-1 text-right">
                <input type="number" disabled={locked} value={item.amount}
                  onChange={(e) => updateItem(item.id, { amount: Number(e.target.value) })}
                  className="border-0 w-full text-right focus:outline-none bg-transparent disabled:bg-transparent" />
              </td>
              <td className="border border-gray-500 px-1 py-1 no-print">
                {!locked && (
                  <div className="flex gap-1 text-xs justify-center">
                    <button onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="disabled:opacity-30">↑</button>
                    <button onClick={() => moveItem(item.id, 1)} disabled={idx === items.length - 1} className="disabled:opacity-30">↓</button>
                    <button onClick={() => removeItem(item.id)} className="text-red-500">✕</button>
                  </div>
                )}
              </td>
            </tr>
            {!locked && (
              <tr className="no-print">
                <td colSpan={4} className="px-2 py-0.5 bg-blue-50/50">
                  <button onClick={() => insertAt(idx + 1)} className="text-blue-600 text-[11px] hover:underline">+ Insert row here</button>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
        <tr className="font-bold bg-gray-50">
          <td className="border border-gray-500" colSpan={2}>
            <div className="px-2 py-1 text-right">{subtotalLabel}</div>
          </td>
          <td className="border border-gray-500 px-2 py-1 text-right">{formatCurrency(subtotal)}</td>
          <td className="border border-gray-500 no-print"></td>
        </tr>
      </tbody>
    </table>
  );
}

export default function PaymentTrackerForm(props: Props) {
  return (
    <RequireAuth>
      <PaymentTrackerFormInner {...props} />
    </RequireAuth>
  );
}

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-gray-300">
      <td className="px-2 py-1 font-medium w-1/3">{label}</td>
      <td className="px-2 py-1">{children}</td>
    </tr>
  );
}
