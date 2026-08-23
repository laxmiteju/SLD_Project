'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { NocLetter, Flat, Project } from '@/types';
import { defaultProjectDescription, DEFAULT_POSSESSION_RULES, CLOSING_PARAGRAPHS } from '@/lib/noc-templates';
import { formatCurrency } from '@/lib/utils';
import { useAuth, RequireAuth } from '@/lib/auth-context';
import AppHeader from '@/components/AppHeader';

interface Props {
  mode: 'new' | 'existing';
  flatId?: string;
  nocId?: string;
}

interface FormState {
  customer_name: string;
  flat_no: string;
  block: string;
  floor: string;
  sba_sqft: number;
  uds_sqyd: number;
  noc_date: string;
  parking_type: string;
  parking_location: string;
  corpus_fund_amount: number;
  corpus_paid_to: string;
  corpus_received_date: string;
  maintenance_amount: number;
  maintenance_paid_to: string;
  maintenance_paid_date: string;
  keys_given: number;
  survey_numbers: string;
  village_details: string;
  short_location: string;
  project_description: string;
  possession_rules: string;
  status: 'draft' | 'final';
}

function NocFormInner({ mode, flatId, nocId }: Props) {
  const router = useRouter();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [recordId, setRecordId] = useState<string | null>(nocId ?? null);
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
          flat_no: flatData.flat_no,
          block: flatData.block ?? '',
          floor: flatData.floor ?? '',
          sba_sqft: flatData.sba_sqft,
          uds_sqyd: flatData.undivided_land_share_sqyd ?? 0,
          noc_date: new Date().toISOString().slice(0, 10),
          parking_type: 'Single Car Parking',
          parking_location: 'Cellar Floor',
          corpus_fund_amount: 0,
          corpus_paid_to: '[ENTER e.g. M/s. PROJECT NAME MEMBERS ASSOCIATION]',
          corpus_received_date: new Date().toISOString().slice(0, 10),
          maintenance_amount: 0,
          maintenance_paid_to: '[ENTER e.g. Teju account]',
          maintenance_paid_date: new Date().toISOString().slice(0, 10),
          keys_given: 1,
          survey_numbers: '[ENTER SURVEY NUMBERS]',
          village_details: '[ENTER VILLAGE, MANDAL, DISTRICT, STATE]',
          short_location: '[ENTER CITY, e.g. Rameswaram Banda, Hyderabad]',
          project_description: defaultProjectDescription(projectData?.name ?? ''),
          possession_rules: DEFAULT_POSSESSION_RULES,
          status: 'draft',
        });
      } else if (mode === 'existing' && nocId) {
        const { data: nocData } = await supabase.from('noc_letters').select('*').eq('id', nocId).single();
        if (!nocData) { setLoading(false); return; }
        const { data: flatData } = await supabase.from('flats').select('*').eq('id', nocData.flat_id).single();
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', nocData.project_id).single();
        setFlat(flatData as Flat);
        setProject(projectData as Project);
        const n = nocData as NocLetter;
        setForm({
          customer_name: n.customer_name ?? '',
          flat_no: n.flat_no,
          block: n.block ?? '',
          floor: n.floor ?? '',
          sba_sqft: n.sba_sqft,
          uds_sqyd: n.uds_sqyd ?? 0,
          noc_date: n.noc_date,
          parking_type: n.parking_type,
          parking_location: n.parking_location,
          corpus_fund_amount: n.corpus_fund_amount,
          corpus_paid_to: n.corpus_paid_to ?? '',
          corpus_received_date: n.corpus_received_date ?? '',
          maintenance_amount: n.maintenance_amount,
          maintenance_paid_to: n.maintenance_paid_to ?? '',
          maintenance_paid_date: n.maintenance_paid_date ?? '',
          keys_given: n.keys_given,
          survey_numbers: n.survey_numbers,
          village_details: n.village_details,
          short_location: n.short_location ?? '',
          project_description: n.project_description,
          possession_rules: n.possession_rules,
          status: n.status,
        });
      }
      setLoading(false);
    }
    load();
  }, [mode, flatId, nocId]);

  const isFrozen = form?.status === 'final';

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form || isFrozen) return;
    setForm({ ...form, [key]: value });
  }

  async function saveNoc(newStatus: 'draft' | 'final') {
    if (!form || !flat || !project) return;
    setSaving(true);
    const payload = { flat_id: flat.id, project_id: project.id, ...form, status: newStatus, updated_at: new Date().toISOString() };

    if (recordId) {
      const { error } = await supabase.from('noc_letters').update(payload).eq('id', recordId);
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setForm({ ...form, status: newStatus });
    } else {
      const { data, error } = await supabase.from('noc_letters').insert(payload).select().single();
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      setRecordId(data.id);
      setForm({ ...form, status: newStatus });
      router.replace(`/noc/${data.id}`);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!recordId || !form) return;
    const msg = form.status === 'final'
      ? 'This is a FINALIZED NOC. Delete it permanently? This cannot be undone.'
      : 'Delete this draft NOC? This cannot be undone.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('noc_letters').delete().eq('id', recordId);
    if (error) {
      alert('Could not delete: ' + error.message + (form.status === 'final' ? ' (only admins can delete finalized NOCs)' : ''));
      return;
    }
    router.push('/noc/history');
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!flat || !project || !form) return <div className="p-8 text-red-600">Could not load data.</div>;

  const input = "border rounded px-2 py-1 text-sm disabled:bg-gray-100";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="p-4 sm:p-8 max-w-4xl mx-auto print:max-w-none print:p-0">
        <div className="flex items-center justify-between mb-4 no-print">
          <h1 className="text-2xl font-semibold text-[#0F2444]">NOC Letter</h1>
          <div className="flex items-center gap-3">
            {isFrozen && <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">FINALIZED</span>}
            <button onClick={() => window.print()} className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
              🖨️ Print / Download PDF
            </button>
          </div>
        </div>

        {!isFrozen && (
          <div className="bg-white border rounded-lg p-4 mb-6 no-print space-y-3">
            <h2 className="font-medium text-sm text-gray-600">Editable details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer Name</label>
                <input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input type="date" value={form.noc_date} onChange={(e) => update('noc_date', e.target.value)} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Keys Given</label>
                <input type="number" value={form.keys_given} onChange={(e) => update('keys_given', Number(e.target.value))} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Corpus Fund Amount (₹)</label>
                <input type="number" value={form.corpus_fund_amount} onChange={(e) => update('corpus_fund_amount', Number(e.target.value))} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Corpus Paid To</label>
                <input value={form.corpus_paid_to} onChange={(e) => update('corpus_paid_to', e.target.value)} placeholder="e.g. M/s. Project Members Association" className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Corpus Received Date</label>
                <input type="date" value={form.corpus_received_date} onChange={(e) => update('corpus_received_date', e.target.value)} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maintenance Amount (₹)</label>
                <input type="number" value={form.maintenance_amount} onChange={(e) => update('maintenance_amount', Number(e.target.value))} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maintenance Paid To</label>
                <input value={form.maintenance_paid_to} onChange={(e) => update('maintenance_paid_to', e.target.value)} placeholder="e.g. Teju account" className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maintenance Paid Date</label>
                <input type="date" value={form.maintenance_paid_date} onChange={(e) => update('maintenance_paid_date', e.target.value)} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Parking Type</label>
                <input value={form.parking_type} onChange={(e) => update('parking_type', e.target.value)} className={input + ' w-full'} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Parking Location</label>
                <input value={form.parking_location} onChange={(e) => update('parking_location', e.target.value)} className={input + ' w-full'} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Short Location (used in address/heading, e.g. "Rameswaram Banda, Hyderabad")</label>
              <input value={form.short_location} onChange={(e) => update('short_location', e.target.value)} className={input + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Survey Numbers</label>
              <input value={form.survey_numbers} onChange={(e) => update('survey_numbers', e.target.value)} className={input + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Village / Mandal / District / State (full, used in legal body text)</label>
              <input value={form.village_details} onChange={(e) => update('village_details', e.target.value)} className={input + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Project Description (blocks/floors)</label>
              <textarea value={form.project_description} onChange={(e) => update('project_description', e.target.value)} rows={2} className={input + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Possession Terms & Rules</label>
              <textarea value={form.possession_rules} onChange={(e) => update('possession_rules', e.target.value)} rows={6} className={input + ' w-full'} />
            </div>
          </div>
        )}

        {/* ===== PRINTABLE DOCUMENT ===== */}
        <div id="printable-sheet" className="text-[13px] leading-relaxed">

          {/* LETTER 1: Allotment of Car Parking */}
          <div className="page-sheet bg-white shadow-md mx-auto mb-10 p-8 sm:p-12 print:shadow-none print:mb-0 print:p-0 max-w-[800px]">
          <p className="text-right text-sm underline mb-3">Customer Copy</p>
          <h2 className="text-center font-bold underline mb-2">LETTER OF ALLOTMENT OF CAR PARKING</h2>
          <p className="text-right mb-4">Date: {form.noc_date}</p>
          <p>TO</p>
          <p className="mt-2 font-semibold">Mr./Ms. {form.customer_name || '____________'}</p>
          <p>Flat No. {form.flat_no}, {form.floor} Floor, {form.block}-Block,</p>
          <p>"{project.name}"</p>
          <p>{form.short_location}</p>
          <p className="font-semibold underline">TELANGANA STATE.</p>
          <p className="mt-4 mb-3">Dear Sir / Madam,</p>
          <p className="mb-3">
            This is with reference to the registered Sale Deed in respect of your Flat No. {form.flat_no} on {form.floor} Floor
            in Block "{form.block}" of an apartment building "{project.name}" in Survey Nos.{form.survey_numbers}, situated at {form.village_details}.
          </p>
          <p className="mb-3">The following are the details of car parking space allotment in respect of your above said flat.</p>
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="text-xs">
                <th className="border border-gray-500 px-2 py-1">Parking Serial Number</th>
                <th className="border border-gray-500 px-2 py-1">Flat Number</th>
                <th className="border border-gray-500 px-2 py-1">Block</th>
                <th className="border border-gray-500 px-2 py-1">No. of Car Parking Spaces</th>
                <th className="border border-gray-500 px-2 py-1">Location</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-center">
                <td className="border border-gray-500 px-2 py-1 font-semibold">Shall be allotted/ decided by Builder</td>
                <td className="border border-gray-500 px-2 py-1">{form.flat_no}</td>
                <td className="border border-gray-500 px-2 py-1">{form.block}</td>
                <td className="border border-gray-500 px-2 py-1 font-semibold">{form.parking_type}</td>
                <td className="border border-gray-500 px-2 py-1 font-semibold">{form.parking_location}</td>
              </tr>
            </tbody>
          </table>
          <p className="mb-3">This letter is issued towards the Allotment of Car Parking Space for your above said flat and this letter shall be forming part and parcel of your registered Sale Deed.</p>
          <p className="mb-4">You shall park your vehicle at the designated area without causing any kind of inconvenience to others.</p>
          <p>Thanking you,</p>
          <p>Yours faithfully,</p>
          <p>FOR M/S. SREE LAXMI DEVELOPERS</p>
          <div className="h-8"></div>
          <p className="mb-4">Managing Partner</p>
          <p className="font-semibold underline text-right mb-4">// CONFIRMED &amp; ACKNOWLEDGED BY //</p>
          <div className="h-6"></div>
          <p className="text-right border-t border-gray-500 w-64 ml-auto pt-1 text-xs">Signature of the Flat Owners</p>
          </div>

          {/* LETTER 2: Delivery of Possession */}
          <div className="page-sheet bg-white shadow-md mx-auto mb-10 p-8 sm:p-12 print:shadow-none print:mb-0 print:p-0 max-w-[800px] print:break-before-page">
            <p className="text-right text-sm underline mb-3">Customer Copy</p>
            <h2 className="text-center font-bold underline mb-4">LETTER OF DELIVERY OF POSSESSION</h2>
            <div className="flex justify-between mb-4">
              <div>
                <p>To</p>
                <p className="mt-2 font-semibold">Mr./Ms. {form.customer_name || '____________'},</p>
                <p>Flat No. {form.flat_no}, {form.floor} Floor, Block "{form.block}"</p>
                <p>"{project.name}"</p>
                <p>{form.short_location}</p>
                <p className="font-semibold underline">TELANGANA STATE.</p>
              </div>
              <p>Date: {form.noc_date}</p>
            </div>
            <p className="mb-3">
              <span className="font-semibold underline">
                SUB : DELIVERY OF POSSESSION OF FLAT NO. {form.block} {form.flat_no} IN THE PROJECT KNOWN AS "{project.name.toUpperCase()}" SITUATED AT {form.short_location.toUpperCase()}.
              </span>
            </p>
            <p className="mb-3">Dear Sir,</p>
            <p className="mb-3">
              With reference to the above, it is to state that the project "{project.name}" {form.project_description} in Survey Nos.{form.survey_numbers}, situated at {form.village_details}.
            </p>
            <p className="mb-3">
              We are glad to deliver the vacant and physical peaceful possession of your Flat No. {form.flat_no} on {form.floor} Floor in Block "{form.block}"
              of an apartment building known as "{project.name}" having plinth area of {form.sba_sqft} Sq.ft. (inclusive of common areas) together with an
              undivided share of land admeasuring {form.uds_sqyd} Sq.yards, constructed in Survey Nos.{form.survey_numbers}, situated at {form.village_details}, along with its keys in all respects.
            </p>
            <p className="mb-3">
              Your said flat has been allotted the {form.parking_type} in the {form.parking_location} and you shall park your vehicle at the designated parking area only.
            </p>
            {form.possession_rules.split('\n\n').map((para: string, i: number) => (
              <p key={i} className="mb-3">{para}</p>
            ))}
            <p className="mb-3">
              You shall have to pay the Maintenance Charges @ Rs. {project.maintenance_rate}/- per Sq.ft. / per month for {project.maintenance_months} months and
              GST {project.gst_percent}% Extra on total Maintenance Value and Corpus fund Rs. {project.corpus_fund_rate}/- per sft from the date of Handing over
              in advance in respect of your flat to the company (i.e., project Developers).
            </p>
            {CLOSING_PARAGRAPHS.split('\n\n').map((para: string, i: number) => (
              <p key={i} className="mb-3">{para}</p>
            ))}
            <p>Thanking you,</p>
            <p>Yours faithfully,</p>
            <p>FOR M/S. {project.name.toUpperCase()}.</p>
            <div className="h-8"></div>
            <p className="mb-8">Managing Partner</p>

            <p className="font-semibold underline text-center mb-4">CONFIRMED AND ACKNOWLEDGED BY THE FLAT PURCHASER</p>
            <p className="mb-3">
              I, do hereby having inspected and received the possession of my Flat No. {form.flat_no} on {form.floor} Floor in Block "{form.block}"
              of an apartment building known as "{project.name}" constructed in Survey Nos.{form.survey_numbers}, situated at {form.village_details} along with its keys in all respects.
            </p>
            <p className="mb-8">
              I also do hereby having agreed for payment of Maintenance Charges regularly and always abide by the rules &amp; regulations etc. of the
              Association / Society and its amendments etc. from time to time without any deviations under any circumstances.
            </p>
            <div className="h-10"></div>
            <p className="text-right border-t border-gray-500 w-80 ml-auto pt-1 text-xs">SIGNATURE OF THE FLAT PURCHASER</p>
          </div>

          {/* LETTER 3: Receipt */}
          <div className="page-sheet bg-white shadow-md mx-auto mb-10 p-8 sm:p-12 print:shadow-none print:mb-0 print:p-0 max-w-[800px] print:break-before-page">
            <h2 className="text-center font-bold underline mb-6 text-lg">RECEIPT</h2>
            <p className="text-right mb-4">DATE: {form.noc_date}</p>
            <p className="mb-4">
              Received with thanks from {form.customer_name || '____________'} towards Corpus fund and Maintenance charges for
              flat no: {form.flat_no}, {form.floor} Floor, {form.block} Block, Project called "{project.name}" Located @ {form.village_details}.
            </p>
            <p className="mb-3">Details Given Below:</p>
            <p className="mb-3">
              Rs. {formatCurrency(form.corpus_fund_amount).replace('₹', '')}/- towards Corpus Fund &amp; Rs. {formatCurrency(form.maintenance_amount).replace('₹', '')}/- towards Maintenance.
            </p>
            <p className="mb-3">
              Corpus Fund Amount Rs.{formatCurrency(form.corpus_fund_amount).replace('₹', '')}/- Paid to {form.corpus_paid_to} on {form.corpus_received_date}.
            </p>
            <p className="mb-3">
              Maintenance Amount Rs.{formatCurrency(form.maintenance_amount).replace('₹', '')}/- Paid to {form.maintenance_paid_to} on {form.maintenance_paid_date}.
            </p>
            <p className="mb-8">
              {form.keys_given} set(s) of key(s) given to the customer(s) on {form.noc_date}.
            </p>
            <div className="h-14"></div>
            <p className="text-left border-t border-gray-500 w-64 pt-1 text-xs">Signature of the Customer</p>
          </div>
        </div>

        {!isFrozen && (
          <div className="flex gap-3 mt-4 no-print">
            <button onClick={() => saveNoc('draft')} disabled={saving} className="border border-gray-300 bg-white px-4 py-2 rounded-md hover:bg-gray-50 text-sm">
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => { if (confirm('Freezing will lock this NOC from further edits. Continue?')) saveNoc('final'); }}
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
              {saving ? 'Saving...' : 'Freeze NOC'}
            </button>
            {recordId && (
              <button onClick={handleDelete} className="border border-red-300 text-red-600 bg-white px-4 py-2 rounded-md hover:bg-red-50 text-sm ml-auto">
                Delete
              </button>
            )}
          </div>
        )}
        {isFrozen && role === 'admin' && (
          <div className="flex mt-4 no-print">
            <button onClick={handleDelete} className="border border-red-300 text-red-600 bg-white px-4 py-2 rounded-md hover:bg-red-50 text-sm ml-auto">
              Delete (admin)
            </button>
          </div>
        )}

        <style jsx global>{`
          @media print {
            .no-print { display: none !important; }
            @page { size: A4; margin: 18mm 18mm 14mm 18mm; }
            input, textarea { color: #000 !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function NocLetterForm(props: Props) {
  return (
    <RequireAuth>
      <NocFormInner {...props} />
    </RequireAuth>
  );
}
