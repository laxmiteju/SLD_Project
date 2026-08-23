'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NocLetterForm from '@/components/NocLetterForm';

function NewNocContent() {
  const searchParams = useSearchParams();
  const flatId = searchParams.get('flat_id');

  if (!flatId) return <div className="p-8 text-red-600">No flat selected. Go back and pick a flat first.</div>;

  return <NocLetterForm mode="new" flatId={flatId} />;
}

export default function NewNocPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <NewNocContent />
    </Suspense>
  );
}
