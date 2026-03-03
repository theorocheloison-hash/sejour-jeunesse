import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardShell from '../_components/DashboardShell';

export default async function TeacherDashboard() {
  const cookieStore = await cookies();
  if (!cookieStore.get('token')) redirect('/login');

  return (
    <DashboardShell role="TEACHER" title="Espace Enseignant">
      <p className="text-gray-600">Bienvenue dans votre espace enseignant.</p>
    </DashboardShell>
  );
}
