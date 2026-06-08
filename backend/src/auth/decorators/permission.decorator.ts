import { SetMetadata } from '@nestjs/common';

export type PermModule = 'planning' | 'sejours' | 'devis' | 'crm' | 'facturation' | 'parametres';

export const PERMISSION_KEY = 'required_permission';

export const RequirePermission = (module: PermModule) =>
  SetMetadata(PERMISSION_KEY, module);
