'use client';

import { useParams } from 'next/navigation';
import CostSheetForm from '@/components/CostSheetForm';

export default function ExistingCostSheetPage() {
  const params = useParams();
  const id = params.id as string;

  return <CostSheetForm mode="existing" costSheetId={id} />;
}
