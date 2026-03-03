import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '../_components/DashboardShell';

export default async function DirectorDashboard() {
  const cookieStore = await cookies();
  if (!cookieStore.get('token')) redirect('/login');

  return (
    <DashboardShell role="DIRECTOR" title="Espace Directeur">
      <p className="text-gray-600">Bienvenue dans votre espace directeur.</p>
    </DashboardShell>
  );
}
