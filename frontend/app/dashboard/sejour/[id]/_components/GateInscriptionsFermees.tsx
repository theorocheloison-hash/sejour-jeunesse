/**
 * Gate organisateur (Lot 4b) : les inscriptions du séjour ne sont pas encore
 * ouvertes par l'hébergeur (sejour.champsInscription null). Purement
 * présentational — calqué sur le gate chambres de TabRooming.
 */
export default function GateInscriptionsFermees() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
      L&apos;hébergeur n&apos;a pas encore ouvert les inscriptions pour ce séjour.
    </div>
  );
}
