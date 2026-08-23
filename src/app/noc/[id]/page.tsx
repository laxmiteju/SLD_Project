'use client';

import { useParams } from 'next/navigation';
import NocLetterForm from '@/components/NocLetterForm';

export default function ExistingNocPage() {
  const params = useParams();
  const id = params.id as string;
  return <NocLetterForm mode="existing" nocId={id} />;
}
