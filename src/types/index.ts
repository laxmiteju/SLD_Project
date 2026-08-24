export type ShareType = 'owner' | 'developer';
export type FlatStatus = 'available' | 'booked' | 'sold';
export type CostSheetStatus = 'draft' | 'final';

export interface Project {
  id: string;
  name: string;
  location: string | null;
  base_rate_per_sqft: number;
  govt_value_per_sqft: number;
  gst_percent: number;
  stamp_duty_percent: number;
  corpus_fund_rate: number;
  maintenance_rate: number;
  maintenance_months: number;
  legal_charges: number;
  default_terms: string | null;
  created_at: string;
}

export interface Flat {
  id: string;
  project_id: string;
  block: string | null;
  flat_no: string;
  floor: string | null;
  facing: string | null;
  sba_sqft: number;
  undivided_land_share_sqyd: number | null;
  share_type: ShareType;
  status: FlatStatus;
  created_at: string;
}

// A single row in the "Additional Charges" section.
// amount = product of all rateFields (e.g. [rate] = direct amount,
// [slots, ratePerSlot] = slots × rate, [rate, sba] = rate × area, etc.)
export interface ChargeItem {
  id: string;
  label: string;
  rateFields: number[]; // 1-3 numbers
  notes: string;
}

export interface CostSheet {
  id: string;
  flat_id: string;
  project_id: string;
  customer_name: string | null;
  sheet_date: string;
  base_rate_per_sqft: number;
  sba_sqft: number;
  govt_value_per_sqft: number;
  gst_percent: number;
  stamp_duty_percent: number;
  charge_items: ChargeItem[];
  terms_and_conditions: string | null;
  status: CostSheetStatus;
  created_at: string;
  updated_at: string;
}
export interface NocLetter {
  id: string;
  flat_id: string;
  project_id: string;
  customer_name: string | null;
  flat_no: string;
  block: string | null;
  floor: string | null;
  sba_sqft: number;
  uds_sqyd: number | null;
  noc_date: string;
  parking_type: string;
  parking_location: string;
  corpus_fund_amount: number;
  corpus_payment_mode: string;
  corpus_cheque_number: string | null;
  corpus_received_date: string | null;
  maintenance_amount: number;
  maintenance_payment_mode: string;
  maintenance_paid_to: string | null;
  maintenance_reference_number: string | null;
  maintenance_paid_date: string | null;
  keys_given: number;
  survey_numbers: string;
  village_details: string;
  short_location: string;
  corpus_paid_to: string | null;
  project_description: string;
  possession_rules: string;
  status: 'draft' | 'final';
  created_at: string;
  updated_at: string;
}
export interface LineItem {
  id: string;
  label: string;
  amount: number;
}

export interface PaymentTracker {
  id: string;
  flat_id: string;
  project_id: string;
  cost_sheet_id: string | null;
  customer_name: string | null;
  subject_note: string;
  tracker_date: string;
  flat_cost_items: LineItem[];
  payable_adjustments: LineItem[];
  payments_received: LineItem[];
  cash_payments: LineItem[];
  cash_payments_note: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
}
export interface LineItem {
  id: string;
  label: string;
  amount: number;
}

export interface PaymentTracker {
  id: string;
  flat_id: string;
  project_id: string;
  cost_sheet_id: string | null;
  customer_name: string | null;
  subject_note: string;
  tracker_date: string;
  flat_cost_items: LineItem[];
  payable_adjustments: LineItem[];
  payments_received: LineItem[];
  cash_payments: LineItem[];
  cash_payments_note: string;
  status: 'active' | 'completed';
  created_at: string;
  updated_at: string;
}
