import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '../_components/DashboardShell';

export default async function VenueDashboard() {
  const cookieStore = await cookies();
  if (!cookieStore.get('token')) redirect('/login');

  return (
    <DashboardShell role="VENUE" title="Espace Hébergement">
      <p className="text-gray-600">Bienvenue dans votre espace hébergement.</p>
    </DashboardShell>
  );
}
