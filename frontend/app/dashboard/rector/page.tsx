import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '../_components/DashboardShell';

export default async function RectorDashboard() {
  const cookieStore = await cookies();
  if (!cookieStore.get('token')) redirect('/login');

  return (
    <DashboardShell role="RECTOR" title="Espace Recteur">
      <p className="text-gray-600">Bienvenue dans votre espace recteur.</p>
    </DashboardShell>
  );
}
