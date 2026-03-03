import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '../_components/DashboardShell';

export default async function ParentDashboard() {
  const cookieStore = await cookies();
  if (!cookieStore.get('token')) redirect('/login');

  return (
    <DashboardShell role="PARENT" title="Espace Parent">
      <p className="text-gray-600">Bienvenue dans votre espace parent.</p>
    </DashboardShell>
  );
}
