ALTER TABLE acceptations_cgv ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE acceptations_cgv ALTER COLUMN centre_id DROP NOT NULL;

ALTER TABLE acceptations_cgv DROP CONSTRAINT "acceptations_cgv_centre_id_fkey";
ALTER TABLE acceptations_cgv ADD CONSTRAINT "acceptations_cgv_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "centres_hebergement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE acceptations_cgv DROP CONSTRAINT "acceptations_cgv_user_id_fkey";
ALTER TABLE acceptations_cgv ADD CONSTRAINT "acceptations_cgv_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
