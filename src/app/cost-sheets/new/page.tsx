'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CostSheetForm from '@/components/CostSheetForm';

function NewCostSheetContent() {
  const searchParams = useSearchParams();
  const flatId = searchParams.get('flat_id');

  if (!flatId) {
    return <div className="p-8 text-red-600">No flat selected. Go back and pick a flat first.</div>;
  }

  return <CostSheetForm mode="new" flatId={flatId} />;
}

export default function NewCostSheetPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <NewCostSheetContent />
    </Suspense>
  );
}
