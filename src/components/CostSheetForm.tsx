'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import type { ChargeItem, CostSheet, Flat, Project } from '@/types';
import {
  calculateCostSheet,
  formatCurrency,
  DEFAULT_TERMS,
  newChargeItem,
  defaultChargeItems,
} from '@/lib/utils';

interface Props {
  mode: 'new' | 'existing';
  flatId?: string;
  costSheetId?: string;
}

interface FormState {
  customer_name: string;
  sheet_date: string;
  base_rate_per_sqft: number;
  sba_sqft: number;
  govt_value_per_sqft: number;
  gst_percent: number;
  stamp_duty_percent: number;
  charge_items: ChargeItem[];
  terms_and_conditions: string;
  status: 'draft' | 'final';
}

export default function CostSheetForm({ mode, flatId, costSheetId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(costSheetId ?? null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    async function load() {
      if (mode === 'new' && flatId) {
        const { data: flatData } = await supabase.from('flats').select('*').eq('id', flatId).single();
        if (!flatData) { setLoading(false); return; }
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', flatData.project_id).single();
        setFlat(flatData as Flat);
        setProject(projectData as Project);
        setForm({
          customer_name: '',
          sheet_date: new Date().toISOString().slice(0, 10),
          base_rate_per_sqft: projectData?.base_rate_per_sqft ?? 0,
          sba_sqft: flatData.sba_sqft,
          govt_value_per_sqft: projectData?.govt_value_per_sqft ?? 0,
          gst_percent: projectData?.gst_percent ?? 5,
          stamp_duty_percent: projectData?.stamp_duty_percent ?? 7.6,
          charge_items: defaultChargeItems(
            {
              corpus_fund_rate: projectData?.corpus_fund_rate ?? 0,
              maintenance_rate: projectData?.maintenance_rate ?? 0,
              maintenance_months: projectData?.maintenance_months ?? 12,
              legal_charges: projectData?.legal_charges ?? 0,
            },
            flatData.sba_sqft
          ),
          terms_and_conditions: projectData?.default_terms || DEFAULT_TERMS,
          status: 'draft',
        });
      } else if (mode === 'existing' && costSheetId) {
        const { data: sheetData } = await supabase.from('cost_sheets').select('*').eq('id', costSheetId).single();
        if (!sheetData) { setLoading(false); return; }
        const { data: flatData } = await supabase.from('flats').select('*').eq('id', sheetData.flat_id).single();
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', sheetData.project_id).single();
        setFlat(flatData as Flat);
        setProject(projectData as Project);
        const s = sheetData as CostSheet;
        setForm({
          customer_name: s.customer_name ?? '',
          sheet_date: s.sheet_date,
          base_rate_per_sqft: s.base_rate_per_sqft,
          sba_sqft: s.sba_sqft,
          govt_value_per_sqft: s.govt_value_per_sqft,
          gst_percent: s.gst_percent,
          stamp_duty_percent: s.stamp_duty_percent,
          charge_items: s.charge_items?.length ? s.charge_items : [],
          terms_and_conditions: s.terms_and_conditions ?? DEFAULT_TERMS,
          status: s.status,
        });
      }
      setLoading(false);
    }
    load();
  }, [mode, flatId, costSheetId]);

  const totals = useMemo(() => {
    if (!form) return null;
    return calculateCostSheet(form);
  }, [form]);

  const isFrozen = form?.status === 'final';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form || isFrozen) return;
    setForm({ ...form, [key]: value });
  }

  function updateItem(id: string, patch: Partial<ChargeItem>) {
    if (!form || isFrozen) return;
    setForm({
      ...form,
      charge_items: form.charge_items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function setRateFieldCount(id: string, count: number) {
    if (!form || isFrozen) return;
    setForm({
      ...form,
      charge_items: form.charge_items.map((it) => {
        if (it.id !== id) return it;
        const fields = [...it.rateFields];
        while (fields.length < count) fields.push(0);
        while (fields.length > count) fields.pop();
        return { ...it, rateFields: fields };
      }),
    });
  }

  function setRateFieldValue(id: string, idx: number, value: number) {
    if (!form || isFrozen) return;
    setForm({
      ...form,
      charge_items: form.charge_items.map((it) => {
        if (it.id !== id) return it;
        const fields = [...it.rateFields];
        fields[idx] = value;
        return { ...it, rateFields: fields };
      }),
    });
  }

  function insertItemAt(index: number) {
    if (!form || isFrozen) return;
    const items = [...form.charge_items];
    items.splice(index, 0, newChargeItem(1));
    setForm({ ...form, charge_items: items });
  }

  function removeItem(id: string) {
    if (!form || isFrozen) return;
    setForm({ ...form, charge_items: form.charge_items.filter((it) => it.id !== id) });
  }

  function moveItem(id: string, direction: -1 | 1) {
    if (!form || isFrozen) return;
    const items = [...form.charge_items];
    const idx = items.findIndex((it) => it.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    setForm({ ...form, charge_items: items });
  }

  async function saveSheet(newStatus: 'draft' | 'final') {
    if (!form || !flat || !project) return;
    setSaving(true);

    const payload = {
      flat_id: flat.id,
      project_id: project.id,
      ...form,
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (sheetId) {
      const { error } = await supabase.from('cost_sheets').update(payload).eq('id', sheetId);
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setForm({ ...form, status: newStatus });
    } else {
      const { data, error } = await supabase.from('cost_sheets').insert(payload).select().single();
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setSheetId(data.id);
      setForm({ ...form, status: newStatus });
      router.replace(`/cost-sheets/${data.id}`);
    }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!flat || !project || !form || !totals) return <div className="p-8 text-red-600">Could not load data.</div>;

  let sno = 1; // running number, item 1 is Base Price
  const navyHeader = "bg-[#1F3864] text-white font-semibold px-2 py-1.5 text-sm";
  const rateBox = "border rounded px-1.5 py-1 text-sm w-20 print:w-auto text-right print:border-0 print:p-0 print:bg-transparent disabled:bg-gray-100";
  const notesBox = "border-0 w-full text-xs focus:outline-none bg-transparent";

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-2xl font-semibold">Flat Cost Sheet</h1>
        <div className="flex items-center gap-3">
          {isFrozen && (
            <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
              FINALIZED
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm"
          >
            🖨️ Print / Download PDF
          </button>
        </div>
      </div>

      <div id="printable-sheet" className="border-2 border-gray-800 bg-white text-[13px]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-gray-800 p-3">
          <Image src="/sld-logo.png" alt="Sree Laxmi Developers" width={44} height={42} />
          <h2 className="text-lg font-bold tracking-wide flex-1 text-center -ml-11">SREE LAXMI DEVELOPERS</h2>
        </div>
        <div className="flex justify-between border-b-2 border-gray-800 px-3 py-1.5">
          <span className="font-semibold">FLAT COST SHEET</span>
          <span className="flex items-center gap-1">
            Date:
            <input type="date" disabled={isFrozen} value={form.sheet_date}
              onChange={(e) => update('sheet_date', e.target.value)}
              className="border-0 focus:outline-none bg-transparent" />
          </span>
        </div>

        {/* Flat details */}
        <table className="w-full border-collapse">
          <tbody>
            <tr><td colSpan={2} className={navyHeader}>FLAT DETAILS</td></tr>
            <DRow label="Project Name:">{project.name}</DRow>
            <DRow label="Customer Name:">
              <input disabled={isFrozen} value={form.customer_name}
                onChange={(e) => update('customer_name', e.target.value)}
                placeholder="Enter customer name"
                className="border-0 w-full focus:outline-none bg-transparent" />
            </DRow>
            <DRow label="Flat No:">{flat.block}-{flat.flat_no}</DRow>
            <DRow label="Floor:">{flat.floor}</DRow>
            <DRow label="Facing:">{flat.facing}</DRow>
            <DRow label="Super Built-up Area (Sq.ft):">{form.sba_sqft}</DRow>
            <DRow label="Government Value (₹ / Sq.ft):">
              <input type="number" disabled={isFrozen} value={form.govt_value_per_sqft}
                onChange={(e) => update('govt_value_per_sqft', Number(e.target.value))}
                className="border-0 w-24 focus:outline-none bg-transparent" />
            </DRow>
          </tbody>
        </table>

        {/* Cost table */}
        <table className="w-full border-collapse border-t-2 border-gray-800" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-200 text-xs font-semibold">
              <th className="border border-gray-400 px-2 py-1 w-10">S.No</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Cost Component</th>
              <th className="border border-gray-400 px-2 py-1 w-52">Rate</th>
              <th className="border border-gray-400 px-2 py-1 w-28">Amount (₹)</th>
              <th className="border border-gray-400 px-2 py-1 text-left">Notes / Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} className={navyHeader}>A. BASIC SALE PRICE</td></tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 text-center">{sno++}</td>
              <td className="border border-gray-400 px-2 py-1">Base Price (per Sq.ft x SBA)</td>
              <td className="border border-gray-400 px-2 py-1 text-right">
                <input type="number" disabled={isFrozen} value={form.base_rate_per_sqft}
                  onChange={(e) => update('base_rate_per_sqft', Number(e.target.value))} className={rateBox} />
              </td>
              <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatCurrency(totals.basicSalePrice)}</td>
              <td className="border border-gray-400 px-2 py-1 text-xs text-gray-600">Rate per Sq.ft x Super Built-up Area</td>
            </tr>

            <tr><td colSpan={5} className={navyHeader}>B. ADDITIONAL CHARGES</td></tr>

            {!isFrozen && (
              <tr className="no-print">
                <td colSpan={5} className="border border-gray-400 px-2 py-1 bg-blue-50">
                  <button onClick={() => insertItemAt(0)} className="text-blue-600 text-xs hover:underline">
                    + Insert row at top
                  </button>
                </td>
              </tr>
            )}

            {form.charge_items.map((item, idx) => {
              const amount = totals.chargeAmounts[idx] ?? 0;
              return (
                <Fragment key={item.id}>
                  <tr>
                    <td className="border border-gray-400 px-2 py-1 text-center align-top">{sno++}</td>
                    <td className="border border-gray-400 px-2 py-1 align-top break-words whitespace-normal">
                      <input disabled={isFrozen} value={item.label}
                        onChange={(e) => updateItem(item.id, { label: e.target.value })}
                        placeholder="Line item label"
                        className="border-0 w-full focus:outline-none bg-transparent" />
                    </td>
                    <td className="border border-gray-400 px-1 py-1 align-top overflow-hidden text-right">
                      <div className="flex items-center justify-end gap-0.5 flex-nowrap no-print">
                        {item.rateFields.map((val, fIdx) => (
                          <span key={fIdx} className="flex items-center gap-0.5 shrink-0">
                            {fIdx > 0 && <span className="text-gray-400 text-xs">×</span>}
                            <input type="number" disabled={isFrozen} value={val}
                              onChange={(e) => setRateFieldValue(item.id, fIdx, Number(e.target.value))}
                              className={rateBox + ' !px-1'}
                              style={{ width: item.rateFields.length === 1 ? 68 : item.rateFields.length === 2 ? 56 : 42 }}
                            />
                          </span>
                        ))}
                      </div>
                      <div className="hidden print:block whitespace-nowrap text-right">
                        {item.rateFields.map((v) => Number(v).toLocaleString('en-IN')).join(' × ')}
                      </div>
                      {!isFrozen && (
                        <select
                          value={item.rateFields.length}
                          onChange={(e) => setRateFieldCount(item.id, Number(e.target.value))}
                          className="text-[11px] text-gray-500 border-0 mt-1 focus:outline-none bg-transparent no-print"
                        >
                          <option value={1}>1 field (direct)</option>
                          <option value={2}>2 fields (a × b)</option>
                          <option value={3}>3 fields (a × b × c)</option>
                        </select>
                      )}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-right font-medium align-top">
                      {formatCurrency(amount)}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 align-top">
                      <div className="flex items-center justify-between gap-1">
                        <input disabled={isFrozen} value={item.notes} placeholder="Notes / basis"
                          onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                          className={notesBox} />
                        {!isFrozen && (
                          <div className="flex gap-1 text-xs shrink-0 no-print">
                            <button onClick={() => moveItem(item.id, -1)} disabled={idx === 0} className="disabled:opacity-30" title="Move up">↑</button>
                            <button onClick={() => moveItem(item.id, 1)} disabled={idx === form.charge_items.length - 1} className="disabled:opacity-30" title="Move down">↓</button>
                            <button onClick={() => removeItem(item.id)} className="text-red-500" title="Delete">✕</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {!isFrozen && (
                    <tr className="no-print">
                      <td colSpan={5} className="border-x border-gray-300 px-2 py-0.5 bg-blue-50/50">
                        <button onClick={() => insertItemAt(idx + 1)} className="text-blue-600 text-[11px] hover:underline">
                          + Insert row here
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            <tr className="bg-gray-100 font-semibold">
              <td colSpan={3} className="border border-gray-400 px-2 py-1 text-right">SUBTOTAL (A + B)</td>
              <td className="border border-gray-400 px-2 py-1 text-right whitespace-nowrap">{formatCurrency(totals.subtotalAB)}</td>
              <td className="border border-gray-400"></td>
            </tr>

            <tr><td colSpan={5} className={navyHeader}>C. STATUTORY CHARGES</td></tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1"></td>
              <td className="border border-gray-400 px-2 py-1">Government Value Amount (Govt. Value x SBA)</td>
              <td className="border border-gray-400 px-2 py-1"></td>
              <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatCurrency(totals.govtValueAmount)}</td>
              <td className="border border-gray-400 px-2 py-1 text-xs text-gray-600">Used as the basis for Stamp Duty + Registration</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 text-center">{sno++}</td>
              <td className="border border-gray-400 px-2 py-1">GST</td>
              <td className="border border-gray-400 px-2 py-1 text-right">
                <span className="flex items-center justify-end gap-0.5">
                  <input type="number" step="0.1" disabled={isFrozen} value={form.gst_percent}
                    onChange={(e) => update('gst_percent', Number(e.target.value))}
                    className="border-0 w-12 text-right focus:outline-none bg-transparent" />%
                </span>
              </td>
              <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatCurrency(totals.gstAmount)}</td>
              <td className="border border-gray-400 px-2 py-1 text-xs text-gray-600">{form.gst_percent}% on Government Value (not sale value)</td>
            </tr>
            <tr>
              <td className="border border-gray-400 px-2 py-1 text-center">{sno++}</td>
              <td className="border border-gray-400 px-2 py-1">Stamp Duty + Registration</td>
              <td className="border border-gray-400 px-2 py-1 text-right">
                <span className="flex items-center justify-end gap-0.5">
                  <input type="number" step="0.1" disabled={isFrozen} value={form.stamp_duty_percent}
                    onChange={(e) => update('stamp_duty_percent', Number(e.target.value))}
                    className="border-0 w-12 text-right focus:outline-none bg-transparent" />%
                </span>
              </td>
              <td className="border border-gray-400 px-2 py-1 text-right font-medium">{formatCurrency(totals.stampDutyAmount)}</td>
              <td className="border border-gray-400 px-2 py-1 text-xs text-gray-600">{form.stamp_duty_percent}% on Government Value (not sale value)</td>
            </tr>
            <tr className="bg-gray-100 font-semibold">
              <td colSpan={3} className="border border-gray-400 px-2 py-1 text-right">SUBTOTAL - Statutory Charges</td>
              <td className="border border-gray-400 px-2 py-1 text-right whitespace-nowrap">{formatCurrency(totals.subtotalStatutory)}</td>
              <td className="border border-gray-400"></td>
            </tr>

            <tr className="bg-amber-200 font-bold text-sm">
              <td colSpan={3} className="border border-gray-400 px-2 py-2 text-right">TOTAL FLAT COST (Payable by Customer)</td>
              <td className="border border-gray-400 px-2 py-2 text-right whitespace-nowrap">{formatCurrency(totals.totalFlatCost)}</td>
              <td className="border border-gray-400"></td>
            </tr>
            <tr className="bg-amber-50 text-xs">
              <td colSpan={3} className="border border-gray-400 px-2 py-1 text-right">Effective Rate (₹ / Sq.ft, all-inclusive)</td>
              <td className="border border-gray-400 px-2 py-1 text-right whitespace-nowrap">{formatCurrency(totals.effectiveRate)}</td>
              <td className="border border-gray-400"></td>
            </tr>
          </tbody>
        </table>

        {/* Terms */}
        <div className="border-t-2 border-gray-800">
          <div className="px-2 py-1 font-semibold text-xs border-b border-gray-400">Terms & Conditions:</div>
          <textarea
            disabled={isFrozen}
            value={form.terms_and_conditions}
            onChange={(e) => update('terms_and_conditions', e.target.value)}
            rows={10}
            className="w-full border-0 px-3 py-2 text-xs leading-relaxed focus:outline-none bg-transparent resize-none no-print"
          />
          <div className="hidden print:block px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
            {form.terms_and_conditions}
          </div>
        </div>
      </div>

      {!isFrozen && (
        <div className="flex gap-3 mt-4 no-print">
          <button onClick={() => saveSheet('draft')} disabled={saving}
            className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => { if (confirm('Freezing will lock this cost sheet from further edits. Continue?')) saveSheet('final'); }}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
            {saving ? 'Saving...' : 'Freeze Cost Sheet'}
          </button>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          #printable-sheet { border: none !important; }
          @page { size: A4; margin: 12mm; }
          input, textarea, select { color: #000 !important; }
          input[type="number"] {
            width: auto !important;
            min-width: 1ch;
            max-width: none !important;
            -moz-appearance: textfield;
          }
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          textarea {
            height: auto !important;
            overflow: visible !important;
            resize: none !important;
          }
        }
      `}</style>
    </div>
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
