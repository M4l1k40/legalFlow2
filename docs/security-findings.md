# Registre des failles et points faibles — LegalFlow

Registre tenu pendant le développement : chaque point est décrit, classé, puis corrigé à l'étape de la feuille de route où il devient naturel
(ou accepté explicitement). Une faille « Corrigée » renvoie au script qui le prouve.

**Gravité** : Élevée = fuite de données ou prise de contrôle possible ; Moyenne = exploitable sous conditions ; Faible / Info = durcissement ou confort.

## 1. Failles corrigées

| ID | Faille | Gravité | Correctif | Preuve |
|---|---|---|---|---|
| SEC-01 | N'importe quel utilisateur connecté (même un client) pouvait lister et créer des clients et des dossiers (`client-service`, `case-service`). | Élevée | Contrôle de rôle par endpoint (`@PreAuthorize`) | `test-role-access.ps1` |
| SEC-02 | Un client voyait **tous** les dossiers du cabinet (filtrage par cabinet seulement, pas par client). | Élevée | Claim `clientId` posé par un administrateur + filtre côté service ; `404` pour les dossiers des autres | `test-role-access.ps1` |
| SEC-03 | `consultation-service` sans aucun contrôle de rôle ni de propriétaire. | Élevée | Règles par rôle + avocat assigné uniquement pour démarrer/répondre | `test-consultation-flow.ps1` |
| SEC-04 | Rendez-vous, factures, échéances, documents, judiciaire et notifications sans contrôle de rôle. | Élevée | Rôles par endpoint + visibilité des données (client, avocat, `visibility` des documents) | `test-role-access-services.ps1` |
| SEC-05 | Gateway : seule la route `/api/clients/**` exigeait un token ; CORS absent. | Moyenne | `/api/**` authentifié, CORS limité à l'origine du frontend | `curl` sans token → `401` |
| SEC-06 | Aucun moyen de créer les comptes d'un cabinet (comptes créés à la main dans Keycloak) ; l'assignation d'une consultation demandait un UUID d'avocat saisi à la main. | Moyenne | `user-service` (annuaire des avocats, création de comptes, `lawFirmId` forcé depuis le token) | `test-user-service.ps1` |
| SEC-20 | **Cloisonnement des avocats absent** : un avocat voyait tous les clients, dossiers, factures, échéances, documents et affaires judiciaires du cabinet (le RBAC ne contrôlait que le rôle, pas la propriété des données). Découvert en testant un compte avocat créé par l'administrateur. | Élevée | Clients : liste d'avocats en charge (`client_lawyers`). Dossiers : visibles par l'avocat assigné. Factures, échéances, documents, judiciaire : visibles si le `case-service` accepte le dossier. Un avocat n'ouvre un dossier que pour lui-même, et l'administration ne peut assigner qu'un avocat en charge du client. | `test-lawyer-scope.ps1` |
| SEC-07 | Notifications : le destinataire était le `sub` Keycloak alors que les événements visent un `clientId` ; les clients ne recevaient jamais leurs notifications. | Moyenne | Convention : `recipientId` = `clientId` (claim du JWT) pour le rôle CLIENT, `sub` pour le personnel ; JWT sans `clientId` ou mêlant CLIENT et rôle du personnel → `403` | tests `NotificationControllerTenantIsolationTest` |
| SEC-08 | Keycloak en mode `dev-file` sans volume : utilisateurs, clients et réglages perdus à chaque recréation du conteneur (constaté deux fois). | Moyenne | Volume nommé `legalflow_keycloak_data` sur `/opt/keycloak/data`. Effet de bord : `legalflow-realm.json` n'est plus réimporté une fois le realm créé | `docker compose up -d --force-recreate keycloak` puis connexion des comptes de test |

**Corrigées lors de la passe de complétion (nov. 2026)**

| ID | Faille | Gravité | Correction |
|---|---|---|---|
| SEC-09 | Email des clients unique globalement : un cabinet pouvait deviner qu'un email existe chez un autre. | Moyenne | **Corrigé** : unicité `(law_firm_id, email)` (migration `client-service` V2, `existsByLawFirmIdAndEmail`). |
| SEC-10 | Tribunaux et juges partagés et modifiables entre cabinets. | Élevée | **Corrigé** : colonne `law_firm_id` (V2 `judicial-service`) ; liste/lecture limitées au cabinet + données partagées historiques (NULL) en **lecture seule** ; création et ajout de juges réservés au cabinet propriétaire. |
| SEC-11 | Documents : `storageKey` fournie par l'appelant. | Moyenne | **Corrigé** : upload réel, clé générée par le serveur et préfixée par le cabinet ; téléchargement refusé pour toute clé hors du préfixe du cabinet. |
| SEC-12 | Ports de tous les services publiés sur l'hôte. | Moyenne | **Corrigé** : `docker-compose.prod.yml` (généré) ne publie que gateway, keycloak, frontend ; Kubernetes : NetworkPolicies + Ingress seul point d'entrée. |
| SEC-13 | Secrets de développement par défaut. | Élevée (prod) | **Corrigé en production** : variables obligatoires (`${VAR:?}`) en Compose prod, `secrets.example.yaml` / External Secrets en Kubernetes ; le realm de prod n'importe aucun utilisateur de test. Les valeurs de développement restent inchangées (volontairement). |
| SEC-14 | `ddl-auto: update` : schéma modifié sans migration versionnée. | Moyenne | **Corrigé** : Flyway (V1 baseline + V2…), `ddl-auto: validate` par défaut (`JPA_DDL_AUTO` pour déroger), migrations rejouées sur PostgreSQL en CI. |
| SEC-15 | Rendez-vous : `lawyerId` non vérifié. | Moyenne | **Corrigé** : le personnel de bureau ne peut planifier que pour un avocat de l'annuaire du cabinet (`user-service`). |
| SEC-16 | Grant `password` activé sur le client public du frontend. | Moyenne | **Corrigé en production** : désactivé dans le realm de prod ; conservé en développement (scripts de test). |
| SEC-17 | Pas de limitation de débit ni de détection de force brute. | Moyenne | **Corrigé** : `bruteForceProtected` (realm, déjà actif, durci en prod : 5 échecs) ; limitation de débit à l'Ingress Kubernetes (20 req/s/IP). Pas de limitation en Compose : à placer sur le reverse proxy. |
| SEC-18 | Mots de passe temporaires : journaux et chiffrement. | Faible | **Vérifié** : aucune journalisation de mot de passe dans le `user-service` ; HTTPS imposé par l'Ingress (TLS) et `sslRequired: external`. |
| SEC-22 | `lawyerIds` d'un client non validés. | Faible | **Corrigé** : validés contre l'annuaire du cabinet (`user-service`) à la création et à l'affectation. |

## 2. Points ouverts / risques acceptés

| ID | Point | Gravité | Statut |
|---|---|---|---|
| SEC-19 | `emailVerified` forcé à `true` à la création d'un compte. | Faible | **Risque accepté** : les comptes sont créés par un administrateur qui connaît la personne ; le mot de passe est temporaire (changement imposé à la première connexion). |
| SEC-21 | Les avocats du cabinet voient les consultations `PENDING` non assignées (nom du client masqué). | Faible | Risque accepté (conception). |
| SEC-23 | Anciens clients sans avocat en charge : visibles de l'administration et du secrétariat seulement. | Info | Les confier depuis la page Clients. |
| SEC-24 | Tribunaux historiques (`law_firm_id` NULL) partagés entre cabinets, en lecture seule. | Info | Chaque cabinet crée désormais les siens ; supprimer les anciens quand plus utilisés. |

## 3. Constats fonctionnels (sans risque de sécurité)

| ID | Constat | Étape |
|---|---|---|
| FUN-01 | Le statut choisi à la création d'un dossier est ignoré : le service force `OPEN`. | Écrans des modules |
| FUN-02 | Judiciaire : pour un client, la liste appelle le `case-service` une fois par affaire. | À la fin, si besoin |
| FUN-03 | Aucun service « cabinets » : le nom d'un cabinet n'est stocké nulle part (seul son `lawFirmId` existe). `create-law-firm.ps1` est un outil du propriétaire de la plateforme. | À discuter |
