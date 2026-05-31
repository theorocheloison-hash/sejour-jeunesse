import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import FacturePDF, { type FacturePDFProps } from './FacturePDF.js';

/** Rend une facture (composant react-pdf) en Buffer PDF côté serveur. */
export async function generateFacturePdf(props: FacturePDFProps): Promise<Buffer> {
  const element = React.createElement(FacturePDF, props);
  // renderToBuffer attend un ReactElement<DocumentProps> ; le composant renvoie bien
  // un <Document>, mais TS ne peut pas l'inférer depuis le type du composant.
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  return Buffer.from(buffer);
}
