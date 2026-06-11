// Script one-shot : applique une CORS policy GET/HEAD sur le bucket OVH liavo-uploads.
// Permet aux navigateurs (liavo.fr / localhost) de fetch les logos/images cross-origin.
//
// Config alignée sur backend/src/storage/storage.service.ts.
// Credentials lus depuis l'environnement — supporte les deux conventions de noms :
//   - du service       : S3_ACCESS_KEY_ID      / S3_SECRET_ACCESS_KEY
//   - du brief OVH      : OVH_S3_ACCESS_KEY     / OVH_S3_SECRET_KEY
//
// Exécution :
//   node scripts/apply-bucket-cors.mjs
//   (les variables d'env doivent être présentes — local ou `scalingo run`)
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT ?? 'https://s3.gra.io.cloud.ovh.net';
const region   = process.env.S3_REGION ?? 'gra';
const bucket   = process.env.S3_BUCKET_NAME ?? 'liavo-uploads';
const accessKeyId     = process.env.S3_ACCESS_KEY_ID     ?? process.env.OVH_S3_ACCESS_KEY;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? process.env.OVH_S3_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error(
    '✗ Credentials manquants. Définissez S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY ' +
    '(ou OVH_S3_ACCESS_KEY/OVH_S3_SECRET_KEY) dans l\'environnement.',
  );
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

const CORSConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: ['https://liavo.fr', 'http://localhost:3000'],
      AllowedMethods: ['GET', 'HEAD'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3600,
    },
  ],
};

async function main() {
  console.log(`→ PutBucketCors sur "${bucket}" (${endpoint}, region ${region})`);
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration }));
  console.log('✓ CORS appliquée.');

  // Relecture de vérification
  const res = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('✓ CORS actuelle du bucket :');
  console.log(JSON.stringify(res.CORSRules, null, 2));
}

main().catch((e) => {
  console.error('✗ Échec PutBucketCors :', e?.name ?? '', e?.message ?? String(e));
  process.exit(1);
});
