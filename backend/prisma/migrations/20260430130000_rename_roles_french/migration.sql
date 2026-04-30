-- ============================================================
-- Migration : rename_roles_french
-- Sous-chantier 2/3 : Renommage des rôles utilisateur en français
-- ============================================================
-- TEACHER  → ORGANISATEUR
-- DIRECTOR → SIGNATAIRE
-- VENUE    → HEBERGEUR
-- RECTOR   → AUTORITE
-- (RESEAU, PARENT, ADMIN inchangés)
-- ============================================================

ALTER TYPE "Role" RENAME VALUE 'TEACHER' TO 'ORGANISATEUR';
ALTER TYPE "Role" RENAME VALUE 'DIRECTOR' TO 'SIGNATAIRE';
ALTER TYPE "Role" RENAME VALUE 'VENUE' TO 'HEBERGEUR';
ALTER TYPE "Role" RENAME VALUE 'RECTOR' TO 'AUTORITE';
