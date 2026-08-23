'use client';

import { useSearchParams } from 'next/navigation';
import NocLetterForm from '@/components/NocLetterForm';

export default function NewNocPage() {
  const searchParams = useSearchParams();
  const flatId = searchParams.get('flat_id');
  if (!flatId) return <div className="p-8 text-red-600">No flat selected. Go back and pick a flat first.</div>;
  return <NocLetterForm mode="new" flatId={flatId} />;
}
