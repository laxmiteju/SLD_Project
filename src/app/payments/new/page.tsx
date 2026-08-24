'use client';

import { useSearchParams } from 'next/navigation';
import PaymentTrackerForm from '@/components/PaymentTrackerForm';

export default function NewPaymentTrackerPage() {
  const searchParams = useSearchParams();
  const flatId = searchParams.get('flat_id');
  if (!flatId) return <div className="p-8 text-red-600">No flat selected. Go back and pick a flat first.</div>;
  return <PaymentTrackerForm mode="new" flatId={flatId} />;
}
