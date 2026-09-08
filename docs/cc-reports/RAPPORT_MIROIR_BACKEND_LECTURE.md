# RAPPORT — Miroir hébergeur Lot 3, volet backend : census de confirmation (Phase 1, lecture seule)

Date : 08/09/2026. Code lu sur le working tree local (`main` = `6ecca24`).

## 1) `backend/src/common/sejour-ownership.ts` — ✅ CONFORME

- **l.2** : `import { getUserCentrePermissions, hasPermission } from '../centres/permission.helper.js';` — les deux helpers sont bien déjà importés.
- **l.21-34** : `peutEcrireSejourEnPropre(prisma, sejour, userId)` — pattern confirmé : court-circuit propriétaire (`peutGererEnPropre`, l.30), puis fail-closed hors DIRECT ou sans `hebergementSelectionneId` (l.31), puis `getUserCentrePermissions` + `hasPermission(perms, 'sejours', 'WRITE')` (l.32-33). Le prédicat de lecture proposé (Phase 2-A) en est le pendant sans la contrainte DIRECT — cohérent.

## 2) `backend/src/sejours/sejour.service.ts` → `getDossierPedagogique` (l.365) — ✅ CONFORME

- **Gardes actuelles** : l.432-434 branche `ORGANISATEUR` (`sejour.createurId !== user.id` → Forbidden) ; l.435-437 branche `SIGNATAIRE` (`assertSignataireCanAccessSejour`). **AUCUNE branche HEBERGEUR** — un hébergeur passerait sans contrôle service (mais la route le bloque, cf. point 3).
- **l.381** : `hebergementSelectionne: { select: { nom, ville, adresse, telephone, imageUrl } }` — **`userId` ABSENT** du select, confirmé.
- **`hebergementSelectionneId` disponible** : le `findUnique` (l.366-428) utilise `include` à la racine → tous les scalaires du séjour sont présents implicitement (nuance Prisma include-racine, déjà consignée SESSION_STATE 24/08 (6)). Confirmé.

## 3) `backend/src/sejours/sejour.controller.ts` → `GET :id/dossier-pedagogique` — ✅ CONFORME

- **l.115-116** : `@Get(':id/dossier-pedagogique')` + `@Roles(Role.ORGANISATEUR, Role.SIGNATAIRE)` — pas de HEBERGEUR.

## 4) `backend/src/autorisations/autorisation.service.ts` → `getBySejour(sejourId, createurId)` (l.669) — ✅ CONFORME

- **l.674-675** : `if (sejour.createurId !== createurId) throw new ForbiddenException('Ce séjour ne vous appartient pas');` — garde confirmée.
- **l.670-672** : `findUnique({ where: { id: sejourId } })` **sans aucun include** → `hebergementSelectionne` NON chargé (scalaires seuls, dont `hebergementSelectionneId` et `createurId`). Confirmé.

## 5) `backend/src/autorisations/autorisation.controller.ts` → `GET sejour/:sejourId` — ✅ CONFORME

- **l.140-142** : `@Get('sejour/:sejourId')` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ORGANISATEUR)` — ORGANISATEUR seul.

## 6) CASCADE — grep exhaustif backend (`grep -rn` sur `src --include=*.ts`) — ✅ AUCUN APPELANT INTERNE

`getDossierPedagogique(` :
```
src/sejours/sejour.controller.ts:117:  getDossierPedagogique(          ← la route (définition handler)
src/sejours/sejour.controller.ts:121:    return this.sejourService.getDossierPedagogique(id, user);   ← SEUL appel
src/sejours/sejour.service.ts:365:  async getDossierPedagogique(id: string, user: JwtUser) {        ← définition
```

`getBySejour(` :
```
src/accompagnateurs/accompagnateur.controller.ts:47-48   ← HOMONYME d'un AUTRE service (accompagnateur.service), hors périmètre
src/accompagnateurs/accompagnateur.service.ts:92         ← définition de l'homonyme
src/accompagnateurs/accompagnateur.service.ts:247        ← commentaire
src/autorisations/autorisation.controller.ts:143:  getBySejour(          ← la route (définition handler)
src/autorisations/autorisation.controller.ts:147:    return this.autorisationService.getBySejour(sejourId, user.id);   ← SEUL appel
src/autorisations/autorisation.service.ts:669:  async getBySejour(sejourId: string, createurId: string) {           ← définition
```

Verdict : chacune des deux méthodes n'est appelée QUE par sa route GET respective. L'homonyme `accompagnateur.service.getBySejour` est une classe distincte, non concernée. Zéro cascade.

## Conclusion

Les 6 points du prompt sont confirmés sur code réel. Le plan Phase 2 (prédicat `peutLireSejourHebergeur` + 2 gardes additifs + 2 élargissements `@Roles`) est applicable tel quel, additif, sans cascade.
