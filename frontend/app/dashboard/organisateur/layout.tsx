import InvitationsPendantesBanner from './_components/InvitationsPendantesBanner';

export default function OrganisateurLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InvitationsPendantesBanner />
      {children}
    </>
  );
}
