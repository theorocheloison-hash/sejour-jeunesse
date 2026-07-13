// Assemble la sortie standalone après `next build` (hook npm postbuild).
// Next n'inclut ni .next/static ni public/ dans le file-tracing standalone :
// ils doivent être copiés à côté de server.js (doc Next "output: standalone").
// Fait au BUILD, pas au boot : le boot Scalingo a un budget de 60 s et ne doit
// contenir que le démarrage du serveur.
import { cpSync, existsSync } from 'node:fs';

if (!existsSync('.next/standalone')) {
  console.error('[prepare-standalone] .next/standalone absent — build standalone manquant ?');
  process.exit(1);
}

cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
if (existsSync('public')) {
  cpSync('public', '.next/standalone/public', { recursive: true });
}
console.log('[prepare-standalone] static + public copiés dans .next/standalone');
