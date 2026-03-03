-- ============================================================
-- Séjour Jeunesse — Script d'initialisation de la base de données
-- PostgreSQL 16
-- ============================================================

-- Extension pour les UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id   SERIAL PRIMARY KEY,
    nom  VARCHAR(50) NOT NULL UNIQUE  -- ex: admin, animateur, participant, parent
);

INSERT INTO roles (nom) VALUES
    ('admin'),
    ('animateur'),
    ('participant'),
    ('parent')
ON CONFLICT (nom) DO NOTHING;

-- ============================================================
-- TABLE : utilisateurs
-- ============================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    prenom          VARCHAR(100) NOT NULL,
    nom             VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe    VARCHAR(255) NOT NULL,
    telephone       VARCHAR(20),
    date_naissance  DATE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE : sejours
-- ============================================================
CREATE TABLE IF NOT EXISTS sejours (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titre            VARCHAR(255) NOT NULL,
    description      TEXT,
    lieu             VARCHAR(255) NOT NULL,
    date_debut       DATE NOT NULL,
    date_fin         DATE NOT NULL,
    places_totales   INTEGER NOT NULL CHECK (places_totales > 0),
    places_restantes INTEGER NOT NULL CHECK (places_restantes >= 0),
    prix             NUMERIC(10, 2) NOT NULL DEFAULT 0,
    statut           VARCHAR(50) NOT NULL DEFAULT 'ouvert'
                         CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE : inscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS inscriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sejour_id       UUID NOT NULL REFERENCES sejours(id) ON DELETE CASCADE,
    utilisateur_id  UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    statut          VARCHAR(50) NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'confirmee', 'annulee', 'remboursee')),
    date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarques       TEXT,
    UNIQUE (sejour_id, utilisateur_id)
);

-- ============================================================
-- TABLE : paiements
-- ============================================================
CREATE TABLE IF NOT EXISTS paiements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inscription_id  UUID NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
    montant         NUMERIC(10, 2) NOT NULL CHECK (montant > 0),
    statut          VARCHAR(50) NOT NULL DEFAULT 'en_attente'
                        CHECK (statut IN ('en_attente', 'valide', 'refuse', 'rembourse')),
    methode         VARCHAR(50) CHECK (methode IN ('carte', 'virement', 'cheque', 'especes')),
    date_paiement   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FONCTION : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_utilisateurs_updated_at
    BEFORE UPDATE ON utilisateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sejours_updated_at
    BEFORE UPDATE ON sejours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inscriptions_sejour      ON inscriptions(sejour_id);
CREATE INDEX IF NOT EXISTS idx_inscriptions_utilisateur ON inscriptions(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_inscription    ON paiements(inscription_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email       ON utilisateurs(email);

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================
INSERT INTO sejours (titre, description, lieu, date_debut, date_fin, places_totales, places_restantes, prix)
VALUES
    ('Séjour Montagne Été 2026', 'Randonnées et activités outdoor en altitude.', 'Chamonix', '2026-07-01', '2026-07-14', 30, 30, 450.00),
    ('Camp Voile Bretagne',      'Initiation et perfectionnement à la voile.',   'Brest',     '2026-08-03', '2026-08-10', 20, 20, 320.00)
ON CONFLICT DO NOTHING;
