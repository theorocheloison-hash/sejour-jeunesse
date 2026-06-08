CREATE TABLE collaborateurs_centre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id UUID NOT NULL REFERENCES centres_hebergement(id) ON DELETE CASCADE,
  user_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  invite_email VARCHAR(255) NOT NULL,
  invite_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  permissions JSONB NOT NULL DEFAULT '{}',
  invite_par UUID NOT NULL REFERENCES utilisateurs(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(centre_id, invite_email)
);
CREATE INDEX idx_collab_centre_user ON collaborateurs_centre(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_collab_centre_centre ON collaborateurs_centre(centre_id);
CREATE INDEX idx_collab_centre_token ON collaborateurs_centre(invite_token);
