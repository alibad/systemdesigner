import { redirect } from 'next/navigation';

// Redirect to main tools page - removing the confusing "calculators" distinction
export default function CalculatorsPage() {
  redirect('/tools');
}