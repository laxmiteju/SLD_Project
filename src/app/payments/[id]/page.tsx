'use client';

import { useParams } from 'next/navigation';
import PaymentTrackerForm from '@/components/PaymentTrackerForm';

export default function ExistingPaymentTrackerPage() {
  const params = useParams();
  const id = params.id as string;
  return <PaymentTrackerForm mode="existing" trackerId={id} />;
}
