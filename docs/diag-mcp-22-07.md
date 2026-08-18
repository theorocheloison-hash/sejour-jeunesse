# Diagnostic MCP filesystem-liavo — 22/07/2026 — LECTURE SEULE

> Collecte effectuée le 22/07/2026 (après-midi). **Aucun fichier modifié, aucune installation, aucune désinstallation.** Seul livrable écrit : ce rapport.
> ⚠️ **Fuseaux** : `main.log`, `main1.log`, `claude.ai-web.log` horodatent en **heure locale** (CEST, UTC+2) ; `mcp.log`, `mcp-server-*.log` horodatent en **UTC** (suffixe `Z`). Les deux sont cités tels quels ; la narration utilise l'heure locale.

---

## A. Version et mises à jour de l'application

### A.1-A.2 — Package installé

```
> Get-AppxPackage *Claude* | Format-List Name, PackageFullName, Version, InstallLocation, Status, SignatureKind
Name              : Claude
PackageFullName   : Claude_1.24012.1.0_x64__pzs8sxrjxfjjc
PackageFamilyName : Claude_pzs8sxrjxfjjc
Version           : 1.24012.1.0
InstallLocation   : C:\Program Files\WindowsApps\Claude_1.24012.1.0_x64__pzs8sxrjxfjjc
Status            : Ok
SignatureKind     : Developer
```

```
> Get-Item 'C:\Program Files\WindowsApps\Claude_1.24012.1.0_x64__pzs8sxrjxfjjc'
CreationTime  : 22/07/2026 09:53:54
LastWriteTime : 22/07/2026 09:54:11
```

Le dossier du package **actuellement actif a été créé le 22/07 à 09:53:54** — le matin même de la panne.

### A.3 — Mises à jour entre le 21/07 et le 22/07 au matin : OUI, DEUX bascules de version le 22/07 au matin

Source : journal `Microsoft-Windows-AppXDeploymentServer/Operational`, événements filtrés sur « Claude », fenêtre 20-22/07. Chronologie reconstituée :

| Date/heure (locale) | Événement (Id) | Contenu |
|---|---|---|
| 20/07 08:45:22 | Register (400) | `Claude_1.22209.0.0` enregistrée (l'app tournait en 1.22209.0.0 depuis ce jour ; `1.21459.3.0` déplacée vers `Deleted`) |
| 20/07 08:50:19 | Add (400) + 658 | `Claude_1.22209.3.0` **téléchargée et stagée**, mais « inscription différée, car 1.22209.0.0 est toujours en cours d'exécution » — **restée en attente les 20 et 21/07** |
| **21/07 (toute la journée)** | — | **Aucun événement de déploiement Claude.** L'app a tourné toute la journée en **1.22209.0.0** (confirmé par les chemins des erreurs EBUSY de main1.log, qui pointent `Claude_1.22209.0.0` jusqu'au 21/07 17:14 inclus) |
| **22/07 09:51:00** | Register (400) + 472 | **Bascule n°1 : `1.22209.3.0` enregistrée** (la 1.22209.0.0 déplacée vers `Deleted`). À 09:53:17, main1.log logge déjà des chemins `Claude_1.22209.3.0` → l'app a redémarré sous 1.22209.3.0 vers 09:53 |
| 22/07 09:53:52 → 09:54:11 | Add (603, 400) + 658 | **`1.24012.1.0` téléchargée et stagée** (18 s), inscription différée (app en cours d'exécution) |
| 22/07 10:14:58 et 10:16:37 | Add (400) ×2 + 638/658 | Deux nouvelles tentatives, toujours différées (app relancée entre-temps) |
| **22/07 10:31:56** | RegisterByPackageFamilyName (603) avec **ForceTargetApplicationShutdownOption** | **Bascule n°2 : `1.24012.1.0` enregistrée à 10:31:57**, arrêt forcé de l'app, `1.22209.3.0` déplacée vers `Deleted` |

Extraits bruts à l'appui (traduits du journal, messages tronqués à la source) :

```
22/07/2026 09:51:00  Id 400  Register ... Claude_1.22209.3.0_x64__pzs8sxrjxfjjc ... terminée.
22/07/2026 09:51:00  Id 472  Déplacement ... Claude_1.22209.0.0 ... vers ...\Deleted\...
22/07/2026 09:54:11  Id 400  Add ... Claude_1.24012.1.0 ... terminée.
22/07/2026 09:54:11  Id 658  Marquage du package {Claude_1.24012.1.0} pour l'inscription différée,
                             car {Claude_1.22209.3.0} est toujours en cours d'exécution.
22/07/2026 10:31:56  Id 603  RegisterByPackageFamilyName ... Claude_pzs8sxrjxfjjc ...
                             ForceTargetApplicationShutdownOption ...
22/07/2026 10:31:57  Id 472  Déplacement ... Claude_1.22209.3.0 ... vers ...\Deleted\...
```

**Corrélation temporelle** (voir §C) : le dernier `tools/call` filesystem-liavo servi date du **21/07 17:53:28 locale** (15:53:28Z) ; le premier appel d'outil émis sans jamais arriver date du **22/07 09:54:11 locale** — la première session sous 1.22209.3.0, deux minutes après la bascule n°1. La panne persiste ensuite sous 1.24012.1.0.

### A.4 — Installation classique (non-Store) concurrente : NON

```
> Get-ItemProperty HKCU/HKLM(+WOW6432Node) ...\Uninstall\* | Where DisplayName -like '*Claude*' ou '*Anthropic*'
(aucun résultat)
```

- `%LOCALAPPDATA%\AnthropicClaude` : **absent** (emplacement de l'installeur classique).
- `%LOCALAPPDATA%\Programs\Claude` et `claude-desktop` : **absents**.
- `%LOCALAPPDATA%\Claude` : existe mais ne contient que `Logs\chrome-native-host.log` (42 Ko, dernière écriture 22/07 09:52) — c'est le log du **native host Chrome** que l'app Store dépose hors sandbox, pas une installation.

**Conclusion A.4 : une seule installation, la version Store.** Pas de double installation.

---

## B. Déclarations en double

### B.5 — Tous les emplacements de déclaration MCP filesystem

| Emplacement | Contenu constaté |
|---|---|
| `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` (chemin packagé effectif) | **`filesystem-liavo`** (node.exe + `...\npm\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js` + 2 répertoires) et **`strava`** (node + `projects\strava-mcp\index.js`). Conforme à l'acquis. **mtime : 22/07 10:33** (voir §C.8bis) |
| Même dossier, `claude_desktop_config.json.txt` (vestige, mtime 22/03) | Ancienne forme : `filesystem-liavo` = `cmd /c npx -y @modelcontextprotocol/server-filesystem C:/Users/Roche-Loison/Desktop/sejour-jeunesse` (un seul répertoire) |
| Extensions Desktop (.mcpb) | **Aucune** : pas de dossier `Claude Extensions`, `[LocalPluginsReader] Found 0 enabled local plugins (0 installed)` (main.log 22/07 10:14:28), `UtilityProcess Check: Extension filesystem-liavo not found in installed extensions` (= pas une extension, comportement normal pour un serveur déclaré en JSON). Blocklist dxt vide (`extensions-blocklist.json` : `entries: []`) |
| `%USERPROFILE%\.claude.json` (Claude Code) | `mcpServers` racine : **null**. Aucun `mcpServers` de projet non vide. **0 occurrence** de « filesystem » dans tout le fichier |
| `.mcp.json` dans les repos | **Absent** de `sejour-jeunesse` et de `trail-assistance\Trail-Assistance-Project` |
| `LocalCache\Roaming\Claude-3p\claude_desktop_config.json` | `{ "enterpriseConfig": {}, "_cfprefsMigrated": true }` — vide |

### B.6 — Serveur filesystem déclaré à la fois en JSON et en extension : NON

Une seule déclaration active, dans le JSON packagé. Pas de doublon.

---

## C. Logs, fenêtre 21/07 soir → 22/07 matin

### C.7 — Erreurs dans main.log / main1.log sur la fenêtre

44 lignes `[error]` datées 21-22/07 dans `main1.log`. Après déduplication, **aucune ne concerne le dispatch d'outils** :

```
n×  [Chrome Extension MCP] Failed to copy native host binary: EBUSY ... chrome-native-host.exe
    (récurrent depuis des jours, à chaque démarrage — le fichier cible est verrouillé par
     une instance du native host ; sans lien avec filesystem-liavo)
2×  21/07 15:13  net::ERR_INTERNET_DISCONNECTED (growthbook, RemotePluginManager, blocklist,
    allowlist, EventLogging) — coupure réseau ponctuelle
2×  21/07 17:40  [EventLogging] POST threw: ERR_INTERNET_DISCONNECTED
2×  22/07 10:10  [SkillsPlugin] Sync failed: net::ERR_CONNECTION_CLOSED
```

Aucune occurrence de `ENOENT`, `crash`, `timeout` liée à MCP dans la fenêtre. Aucun mot-clé `dispatch`. Les `[warn] Blocked permission check` récurrents dans main.log concernent la permission web `background-sync` de frames web (`a.claude.ai`, et après 10:56 des origines de pages tierces) — sans rapport.

### C.8 — Fin de main1.log : ce n'est PAS une rotation à 10 Mo

Les 200 dernières lignes de `main1.log` (10 522 382 octets, dernière écriture 10:14) contiennent une **séquence d'arrêt propre et complète** de l'application :

```
2026-07-22 10:14:14 [info] Successfully run onQuitCleanup: mcp-shutdown
2026-07-22 10:14:14 [info] [LocalMcpServerManager] Closing filesystem-liavo
2026-07-22 10:14:14 [warn] [LocalMcpServerManager] filesystem-liavo disconnected
2026-07-22 10:14:14 [info] [LocalMcpServerManager] Closing all (0 servers)
2026-07-22 10:14:15 [info] Successully ran all onQuitCleanup handlers, marking readyForQuit
2026-07-22 10:14:15 [info] beforeQuit: handler fired, going down
2026-07-22 10:14:15 [info] willQuit: handler is ready for quit, so quitting
```

Le fichier se termine sur `willQuit ... quitting` : **quit applicatif à 10:14:15**, suivi d'un redémarrage à 10:14:23 (premières lignes de main.log). La taille ~10,5 Mo est une coïncidence ; le basculement main1→main correspond au cycle quit/relaunch, pas à une troncature en plein flux. Rien d'anormal dans le contenu du basculement.

### C.8bis — Fait nouveau : la commande de lancement de filesystem-liavo a changé le 22/07 entre 10:32 et 10:34

`mcp.log` (UTC) logge la commande configurée à chaque démarrage de serveur :

```
2026-07-22T07:53:19Z [filesystem-liavo] Using MCP server command: C:\WINDOWS\system32\cmd.exe   (= 09:53 locale)
2026-07-22T08:14:25Z [filesystem-liavo] Using MCP server command: C:\WINDOWS\system32\cmd.exe   (= 10:14)
2026-07-22T08:16:04Z [filesystem-liavo] Using MCP server command: C:\WINDOWS\system32\cmd.exe   (= 10:16)
2026-07-22T08:32:00Z [filesystem-liavo] Using MCP server command: C:\WINDOWS\system32\cmd.exe   (= 10:32)
2026-07-22T08:34:27Z [filesystem-liavo] Using MCP server command: C:\Program Files\nodejs\node.exe  (= 10:34)
```

(`strava` est lancé via node.exe à chaque session, sans changement.)

Recoupements matériels :

```
claude_desktop_config.json                                mtime 22/07 10:33
%APPDATA%\npm\node_modules\@modelcontextprotocol\server-filesystem\   CreationTime 22/07 10:27:16
```

Donc, le matin du 22/07 : jusqu'à 10:32 inclus, le serveur tournait encore sous la **forme héritée `cmd /c npx ...`** (celle du vestige `.txt`) ; à 10:27 le package npm global a été installé ; à 10:33 la config a basculé vers la forme actuelle `node.exe + dist\index.js` ; la session de 10:34 est la première sous cette forme. **La panne est antérieure à ce changement (premier appel perdu à 09:54) et lui a survécu (appels de 10:36 perdus aussi)** — le changement de config fait partie du dépannage, pas de la cause. À noter : l'acquis « config = node.exe + dist\index.js, validée » décrit l'état **postérieur à 10:33**, pas celui du moment de la rupture.

### C.9 — claude.ai-web.log : les appels d'outils ÉMIS côté web, et la comparaison avec le transport

Émissions d'appels visibles côté web (heure locale) :

```
21/07 16:37:31 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:edit_file",  approvalRequired: false}
21/07 16:37:52 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:edit_file",  approvalRequired: false}
22/07 09:54:11 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:list_directory", approvalRequired: false}
22/07 09:54:18 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:read_text_file", approvalRequired: false}
22/07 10:11:06 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:read_text_file", approvalRequired: false}
22/07 10:32:51 [warn] [MCP] tool_approval_gate {toolName: "memory_append", approvalRequired: false}
22/07 10:36:12 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:list_directory", approvalRequired: false}
22/07 10:36:25 [warn] [MCP] tool_approval_gate {toolName: "filesystem-liavo:list_directory", approvalRequired: false}
```

Côté transport (`mcp.log` / `mcp-server-filesystem-liavo.log`, UTC) :

- Dernier `tools/call` filesystem-liavo **servi** : `2026-07-21T15:53:28.282Z` (= 17:53:28 locale, id=185). 7710 `tools/call` au total dans le log serveur — le pipeline a massivement fonctionné jusque-là.
- **Aucun** `tools/call` filesystem-liavo le 22/07, dans aucune des 5 sessions (09:53, 10:14, 10:16, 10:32, 10:34 locale). Chaque session montre le handshake complet et rien d'autre :

```
2026-07-22T08:34:27.636Z [filesystem-liavo] Server started and connected successfully
2026-07-22T08:34:28.312Z [filesystem-liavo] Message from server: id=0 result          (initialize)
2026-07-22T08:34:30.561Z [filesystem-liavo] method="notifications/initialized"
2026-07-22T08:34:30.564Z [filesystem-liavo] method="tools/list" id=1
2026-07-22T08:34:30.569Z [filesystem-liavo] Message from server: id=1 result          (5 ms)
(fin du fichier — plus aucune écriture après, mtime 10:34)
```

- **⚠️ FAIT NOUVEAU, discriminant** : un `tools/call` **strava** a été dispatché et servi le 22/07 **en pleine fenêtre de panne** :

```
2026-07-22T08:24:38.682Z [strava] Message from client: method="tools/call" id=2 params      (= 10:24:38 locale)
2026-07-22T08:24:38.688Z [strava] Message from server: id=2 result(1 blocks)
```

  Le mécanisme de dispatch client → serveur MCP local **n'était donc pas globalement mort** : à 10:24 il a fonctionné pour strava, alors que les appels filesystem-liavo de 09:54 et 10:11 (avant) et 10:36 (après) ne sont jamais arrivés au transport. La rupture est **sélective sur filesystem-liavo** (ou sur la surface/conversation qui l'appelle), pas un blocage global du dispatch.

- Erreurs du web log dans la fenêtre : uniquement des `Failed to fetch` / `network error` réseau (21/07 15:26-17:39, 22/07 10:10) et une erreur AudioContext. **Aucune erreur associée aux émissions `tool_approval_gate` de 09:54/10:11/10:36** — l'appel est émis, gate franchie (`approvalRequired: false`), puis plus aucune trace, dans aucun log.

- Les identifiants `toolu_*` n'apparaissent que dans claude.ai-web.log, y compris pour l'appel réussi du 21/07 (vérifié sur `toolu_01NCK98KBHk9UDPD7VMZp3Xq`) : le traçage inter-logs par ID est impossible avec ces logs. Le point de perte exact entre la webview et `LocalMcpServerManager` est donc **INDÉTERMINÉ** depuis cette machine.

- À chaque démarrage du 22/07, la connexion et l'annonce ont pourtant réussi :

```
2026-07-22 10:34:29 [info] [LocalMcpServerManager] Connected to filesystem-liavo (14 tools)
2026-07-22 10:34:29 [info] [localMcpBridge] announcing filesystem-liavo: 14 tool(s)
2026-07-22 10:34:29 [info] [remote-tools-device] connecting DO bridge with: ... (+0 grand-prix, +17 local-mcp)
2026-07-22 10:34:29 [info] [remote-tools-device] connecting wss://bridge.claudeusercontent.com/devices/.../desktop-ok1k9pi/bridge
```

  Les 17 outils locaux (14 filesystem + 3 strava) sont aussi annoncés au **bridge distant** (`bridge.claudeusercontent.com`), qui s'authentifie avec succès à 10:32:04 et 10:34:29+. Si les appels de la conversation transitent par ce chemin distant, leur perte se produirait hors de la machine — **non observable dans ces logs** (voir Hypothèses).

---

## D. Environnement

### D.10 — Node

```
> node --version
v24.14.0
> where.exe node
C:\Program Files\nodejs\node.exe        (unique)
> where.exe npx
C:\Program Files\nodejs\npx
C:\Program Files\nodejs\npx.cmd
```

Pas de nvm (`%APPDATA%\nvm` absent), pas de node x86, pas de scoop. **Une seule installation de Node.** Le point d'entrée configuré existe et est exécutable :

```
C:\Users\Roche-Loison\AppData\Roaming\npm\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js
  28 217 octets, mtime 22/07 10:27  (package créé le 22/07 à 10:27:16 — cf. §C.8bis)
```

### D.11 — Dates du cache du package

```
> Get-ChildItem $env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc
AC / AppData / LocalCache / LocalState / RoamingState / SystemAppData / TempState : 22/03/2026
Settings : 25/03/2026
```

Les racines du cache n'ont **pas** été touchées le 22/07 (dates de création d'origine, 22/03). L'activité du 22/07 au matin est confinée à `LocalCache\Roaming\Claude\` (logs, config, caches de session — écritures normales d'une app vivante). **Rien de suspect** : pas de reset du conteneur, pas de purge.

---

## HYPOTHÈSES — classées par niveau de preuve

**H1 — PROUVÉ (corrélation), mécanisme non prouvé : la panne coïncide avec les mises à jour Store du 22/07 au matin.**
Dernier appel servi : 21/07 17:53:28. L'app a tourné en 1.22209.0.0 toute la journée du 21/07 sans un seul événement de déploiement. Le 22/07 : bascule 1.22209.0.0 → 1.22209.3.0 à 09:51 (mise à jour stagée depuis le 20/07, restée différée), redémarrage ~09:53, et **premier appel perdu à 09:54:11**. Deuxième bascule → 1.24012.1.0 à 10:31 : panne toujours présente (appels de 10:36 perdus). La séquence temporelle est établie par trois sources indépendantes (journal AppX, chemins de version dans les logs, mcp.log). Ce qui reste non prouvé : *quel* changement dans 1.22209.3.0/1.24012.1.0 casse le chemin d'appel.

**H2 — PROUVÉ : la rupture est sélective, pas globale.**
Un `tools/call` strava a été dispatché et servi à 10:24:38 locale le 22/07, entre deux émissions filesystem-liavo perdues (10:11 et 10:36). Le dispatch local client→serveur fonctionnait donc pour au moins un serveur MCP pendant la panne. L'énoncé « rupture en amont du dispatch » reste vrai pour filesystem-liavo, mais il ne s'agit pas d'un arrêt du dispatcher en soi. Nuance : l'appel strava et les appels filesystem proviennent potentiellement de surfaces/conversations différentes — le log ne permet pas de le déterminer.

**H3 — COMPATIBLE AVEC LES FAITS, NON PROUVABLE DEPUIS CETTE MACHINE : perte côté chemin distant ou état de conversation.**
Les outils locaux sont annoncés à deux endroits : au bridge local (`localMcpBridge`) et au bridge distant (`remote-tools-device` → `wss://bridge.claudeusercontent.com`, « +17 local-mcp »). Les émissions perdues franchissent la gate web (`approvalRequired: false`) puis disparaissent sans erreur locale. Si la conversation route ses appels via le chemin distant, la perte se produit hors machine (état de session/périphérique invalidé par le double changement de version, par exemple). **INDÉTERMINÉ** : aucun log local ne montre le tronçon gate → dispatch. C'est la limite franche de ce diagnostic : **le point de perte exact n'est pas déterminable depuis cette machine.**

**H4 — ÉCARTÉES PAR LES FAITS :**
- Double installation (A.4 : registre vide, dossiers absents).
- Double déclaration JSON/extension (B.6 : zéro extension installée, `.claude.json` sans filesystem, pas de `.mcp.json`).
- Rotation de log anormale (C.8 : quit propre).
- Node/npx multiple ou point d'entrée manquant (D.10).
- Corruption du cache du package (D.11).
- Erreur au démarrage du serveur (5 handshakes complets le 22/07, sous les deux formes de lancement `cmd/npx` puis `node.exe`).

**Note d'exactitude sur l'acquis initial** : la config « node.exe + dist\index.js » n'est l'état du système que **depuis 10:33 le 22/07** (§C.8bis : npm global installé à 10:27, config modifiée à 10:33, première session sous cette forme à 10:34). Au moment de la rupture (09:54), la forme active était encore `cmd /c npx ...`. La panne étant identique sous les deux formes, cela **renforce** la conclusion « la config n'est pas en cause » — mais la chronologie du dépannage mérite d'être consignée telle quelle.

---

## ACTIONS PROPOSÉES — descriptives uniquement, AUCUNE exécutée

1. **Test discriminant conversation neuve** : émettre un appel filesystem-liavo depuis une **nouvelle conversation** (et idéalement un appel strava depuis la même conversation), en surveillant `mcp.log`. Si strava passe et filesystem non dans la même conversation, la sélectivité est côté serveur/outil ; si tout passe en conversation neuve, l'état de la conversation d'origine était en cause.
2. **Déconnexion/reconnexion du compte dans l'app** (ou redémarrage complet de l'app) pour forcer la ré-authentification du bridge distant `remote-tools-device` — cible l'hypothèse H3.
3. **Signalement à Anthropic** (bug report depuis l'app ou https://github.com/anthropics/claude-desktop-issues) avec ce rapport : régression du chemin d'appel des serveurs MCP JSON locaux à partir de 1.22209.3.0 / 1.24012.1.0 (build Store `pzs8sxrjxfjjc`), handshake OK, tools/list OK, tools/call jamais transmis, appel d'un autre serveur local servi pendant la panne.
4. **Si un retour arrière est envisagé** (décision à part, rien d'exécuté ici) : la version Store ne se « downgrade » pas simplement ; les paquets précédents ont été déplacés vers `WindowsApps\Deleted\...`. Les options réalistes sont : attendre un correctif, ou basculer temporairement sur l'installeur classique (claude.ai/download) — en sachant que cela créerait la double installation qu'on vient d'exclure, à faire proprement (une seule active à la fois).
5. **Conserver les logs en l'état** tant que le signalement n'est pas fait : `main1.log` (fenêtre de la panne) et `mcp.log` seront écrasés par rotation à terme. Une copie de sauvegarde de `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\` vers un dossier de travail est recommandée (non faite — mission lecture seule).

---

*Fin du rapport. Aucune modification effectuée sur la machine en dehors de la création de ce fichier.*
