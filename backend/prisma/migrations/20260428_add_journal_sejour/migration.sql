-- CreateTable
CREATE TABLE "posts_journal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sejour_id" UUID NOT NULL,
  "auteur_id" UUID NOT NULL,
  "contenu" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "posts_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos_journal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "ordre" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "photos_journal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_posts_journal_sejour" ON "posts_journal"("sejour_id");

-- CreateIndex
CREATE INDEX "idx_photos_journal_post" ON "photos_journal"("post_id");

-- AddForeignKey
ALTER TABLE "posts_journal" ADD CONSTRAINT "posts_journal_sejour_id_fkey" FOREIGN KEY ("sejour_id") REFERENCES "sejours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_journal" ADD CONSTRAINT "posts_journal_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "utilisateurs"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos_journal" ADD CONSTRAINT "photos_journal_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts_journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
