import type { ChargeItem } from '@/types';

export function formatCurrency(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function chargeItemAmount(item: ChargeItem): number {
  return item.rateFields.reduce((a, b) => a * (Number(b) || 0), 1);
}

export interface CostSheetInputs {
  base_rate_per_sqft: number;
  sba_sqft: number;
  govt_value_per_sqft: number;
  gst_percent: number;
  stamp_duty_percent: number;
  charge_items: ChargeItem[];
}

export function calculateCostSheet(i: CostSheetInputs) {
  const basicSalePrice = i.base_rate_per_sqft * i.sba_sqft;

  const chargeAmounts = i.charge_items.map((item) => chargeItemAmount(item));
  const additionalChargesTotal = chargeAmounts.reduce((sum, a) => sum + a, 0);

  const subtotalAB = basicSalePrice + additionalChargesTotal;

  const govtValueAmount = i.govt_value_per_sqft * i.sba_sqft;
  const gstAmount = (i.gst_percent / 100) * govtValueAmount;
  const stampDutyAmount = (i.stamp_duty_percent / 100) * govtValueAmount;
  const subtotalStatutory = gstAmount + stampDutyAmount;

  const totalFlatCost = subtotalAB + subtotalStatutory;
  const effectiveRate = i.sba_sqft > 0 ? totalFlatCost / i.sba_sqft : 0;

  return {
    basicSalePrice,
    chargeAmounts,
    additionalChargesTotal,
    subtotalAB,
    govtValueAmount,
    gstAmount,
    stampDutyAmount,
    subtotalStatutory,
    totalFlatCost,
    effectiveRate,
  };
}

export function newChargeItem(numRateFields: 1 | 2 | 3 = 1): ChargeItem {
  return {
    id: crypto.randomUUID(),
    label: '',
    rateFields: Array(numRateFields).fill(0),
    notes: '',
  };
}

export function defaultChargeItems(
  project: {
    corpus_fund_rate: number;
    maintenance_rate: number;
    maintenance_months: number;
    legal_charges: number;
  },
  sbaSqft: number
): ChargeItem[] {
  return [
    {
      id: crypto.randomUUID(),
      label: 'Car Parking Charges',
      rateFields: [0, 0], // [slots, rate per slot]
      notes: 'Per slot x no. of slots',
    },
    {
      id: crypto.randomUUID(),
      label: 'Amenities Charges',
      rateFields: [0], // direct amount
      notes: 'One-time',
    },
    {
      id: crypto.randomUUID(),
      label: 'Corpus Fund',
      rateFields: [project.corpus_fund_rate, sbaSqft], // [rate/sqft, SBA]
      notes: 'One-time',
    },
    {
      id: crypto.randomUUID(),
      label: 'Maintenance Deposit (Advance)',
      rateFields: [project.maintenance_rate, project.maintenance_months, sbaSqft], // [rate/sqft, months, SBA]
      notes: `${project.maintenance_months} months`,
    },
    {
      id: crypto.randomUUID(),
      label: 'Legal & Documentation Charges',
      rateFields: [project.legal_charges], // direct amount
      notes: 'Document writer charges',
    },
  ];
}

export const DEFAULT_TERMS = `1. Booking will be confirmed only upon receipt of the booking advance and execution of the Agreement of Sale / Sale Agreement.
2. Payments are to be made as per the agreed payment schedule; delayed payments will attract interest as specified in the Agreement of Sale.
3. Stamp Duty, Registration Charges, GST, and other statutory levies shall be borne by the customer over and above the sale consideration, at rates prevailing on the date of registration.
4. Car parking is allotted and not owned as an independent unit, and shall be used strictly for parking purposes only, as per RERA norms.
5. Maintenance charges shall commence from the date of offer of possession, irrespective of the actual date of occupation by the customer.
6. Any modification, customization, or additional work requested by the customer beyond the standard specifications shall be charged extra.
7. Possession will be handed over only after full and final payment of all dues, including statutory charges, as per this cost sheet and the Agreement of Sale.
8. This cost sheet is indicative and does not constitute a legal offer; the terms of the registered Agreement of Sale / Sale Deed shall prevail in case of any discrepancy.`;