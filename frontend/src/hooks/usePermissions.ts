'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

export type PermissionLevel = 'NONE' | 'READ' | 'WRITE';

export interface CentrePermissions {
  isOwner: boolean;
  planning: PermissionLevel;
  sejours: PermissionLevel;
  devis: PermissionLevel;
  crm: PermissionLevel;
  facturation: PermissionLevel;
  parametres: PermissionLevel;
}

const OWNER: CentrePermissions = {
  isOwner: true, planning: 'WRITE', sejours: 'WRITE', devis: 'WRITE',
  crm: 'WRITE', facturation: 'WRITE', parametres: 'WRITE',
};

const LOCKED: CentrePermissions = {
  isOwner: false, planning: 'NONE', sejours: 'NONE', devis: 'NONE',
  crm: 'NONE', facturation: 'NONE', parametres: 'NONE',
};

export function usePermissions() {
  const { centreActif, user } = useAuth();
  const [perms, setPerms] = useState<CentrePermissions>(OWNER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!centreActif || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get<CentrePermissions>('/centres/mes-permissions')
      .then(({ data }) => setPerms(data))
      .catch(() => setPerms(LOCKED)) // LOCKED pas OWNER — sécurité
      .finally(() => setLoading(false));
  }, [centreActif, user]);

  const can = (
    module: keyof Omit<CentrePermissions, 'isOwner'>,
    level: 'READ' | 'WRITE' = 'READ',
  ): boolean => {
    if (perms.isOwner) return true;
    const l = perms[module];
    if (level === 'READ') return l === 'READ' || l === 'WRITE';
    return l === 'WRITE';
  };

  return { perms, loading, can, isOwner: perms.isOwner };
}
