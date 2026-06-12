-- Auth enseignant unifié : flag indiquant que l'utilisateur a défini un vrai mot de passe.
-- Tous les comptes existants sont marqués true (ils ont un mot de passe connu ou feront
-- "mot de passe oublié"). Le flag false ne concernera que les nouveaux comptes auto-créés
-- via demande publique (/appel-offres) après ce déploiement → flux magic link + needsPassword.
ALTER TABLE utilisateurs ADD COLUMN mot_de_passe_defini BOOLEAN NOT NULL DEFAULT false;
UPDATE utilisateurs SET mot_de_passe_defini = true;
