# Déploiement de LegalFlow

## 1. Plateforme complète en local (Docker Compose)

```bash
cp .env.example .env            # puis remplacez les valeurs « change-me »
cd infrastructure
docker compose \
  -f docker-compose.yml -f docker-compose.user-service.yml -f docker-compose.platform.yml \
  up -d --build
```

| Service | URL | Remarque |
|---|---|---|
| Application (frontend nginx) | http://localhost:5173 | seule origine autorisée par Keycloak/gateway |
| Gateway (API) | http://localhost:9000 | |
| Keycloak | http://localhost:8080 | |
| MinIO (console) | http://localhost:9001 | l'API S3 reste interne |
| Prometheus | http://localhost:9090 | limité à la machine locale |
| Grafana | http://localhost:3000 | dashboard « LegalFlow — Vue d'ensemble » provisionné |
| Mailpit | http://localhost:8025 | emails de dev |

Le frontend de développement (`npm run dev`, même port 5173) n'est pas à lancer en parallèle du conteneur.

## 2. Test manuel du flux documents (MinIO)

1. Connectez-vous en avocat, ouvrez **Documents**, choisissez un dossier.
2. Téléversez un fichier : il apparaît dans la liste et dans la console MinIO (bucket `legalflow-documents`, clés `<cabinet>/<dossier>/<uuid>`).
3. Connectez-vous en client du dossier : seuls les documents `CASE_MEMBERS` sont visibles et téléchargeables.

## 3. Kubernetes (kustomize)

Prérequis : un cluster, l'Ingress NGINX, cert-manager (ClusterIssuer `letsencrypt-prod`), un registre accessible (GHCR par défaut).

```bash
cd infrastructure/kubernetes
cp secrets.example.yaml secrets.yaml      # remplacez chaque REPLACE_ME (openssl rand -base64 32) ; NE PAS COMMITER
kubectl apply -f base/namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -k base
```

À adapter avant la mise en production :

* **Domaines** : `base/networking.yaml` (hôtes `*.legalflow.example.com`) et `KEYCLOAK_ISSUER_URI` dans `base/configmap.yaml`
  (ces fichiers sont générés : modifiez `generate.py`, puis relancez-le).
* **Keycloak** : dans `infrastructure/keycloak/legalflow-realm.json`, ajoutez les URL de production aux `redirectUris` et
  `webOrigins` du client `legalflow-frontend`, et remplacez les secrets de clients de service. Idem pour la liste d'origines CORS de la gateway.
* **Frontend** : construit avec `VITE_API_URL`, `VITE_KEYCLOAK_URL`… de production (arguments de build du `Dockerfile`).
* **Images** : tags `latest` par défaut ; le workflow `CD` publie `vX.Y.Z` et `sha-xxxxxxx` sur GHCR (scan Trivy bloquant).
* **Sauvegardes** : les 10 StatefulSets PostgreSQL et MinIO utilisent des PVC ; planifiez `pg_dump` + sauvegarde du volume MinIO.

Régénérer les manifestes : `python3 infrastructure/kubernetes/generate.py` (la CI vérifie qu'ils sont à jour et valides).

## 4. Intégration continue / livraison

* `ci.yml` : tests de la lib d'événements, des 11 modules backend, lint + tests + build du frontend, validation des manifestes K8s, tests d'intégration Compose (PR vers `main`).
* `cd.yml` : sur tag `v*` — build, scan Trivy, push GHCR de 12 images ; job `deploy` optionnel (variable `DEPLOY_ENABLED=true` + secret `KUBE_CONFIG` en base64).

## 5. Supervision

Chaque service expose `/actuator/prometheus` (Micrometer). `infrastructure/monitoring/alerts.yml` : service arrêté, taux 5xx > 5 %,
latence p95 > 1 s, heap > 90 %. Ces endpoints ne doivent **pas** être exposés par l'Ingress (ils ne le sont pas).

## 6. Production avec Docker Compose (un seul serveur)

```bash
cp .env.prod.example .env.prod          # remplacez TOUTES les valeurs (openssl rand -base64 32)
cd infrastructure
docker compose -f docker-compose.yml -f docker-compose.user-service.yml -f docker-compose.platform.yml \
  -f docker-compose.prod.yml --env-file ../.env.prod up -d --build
```

`docker-compose.prod.yml` (généré par `scripts/generate-prod-compose.py`, Compose ≥ 2.24) :
* ne publie que **gateway (9000), keycloak (8080) et frontend (5173)** : placez-les derrière un reverse proxy TLS
  (Caddy, nginx, Traefik) qui applique aussi la limitation de débit ;
* **refuse de démarrer** tant qu'un secret manque (`${VAR:?}`) ;
* passe Keycloak en mode production (`start`, base PostgreSQL dédiée, realm `keycloak/prod/legalflow-realm.json` sans
  utilisateur de test, grant « password » désactivé). Les scripts PowerShell de test ne fonctionnent donc plus en production : c'est voulu.

Premier compte en production : connectez-vous à la console Keycloak (`KEYCLOAK_PUBLIC_URL`) et créez le cabinet avec
`create-law-firm.ps1` ou à la main.

## 7. Base de données : Flyway

* Chaque service à base PostgreSQL embarque `db/migration/V1__baseline_schema.sql` (schéma historique) puis des `V2…`
  (SEC-09 emails par cabinet, SEC-10 tribunaux par cabinet, rappel de rendez-vous).
* **Base neuve** : V1 puis V2 s'exécutent. **Base existante** (créée avant Flyway) : Flyway la « baseline » à V1 sans rien rejouer,
  puis applique V2+. Aucune manipulation manuelle.
* `ddl-auto` vaut `validate` : au démarrage Hibernate vérifie le schéma et s'arrête sur un écart. En cas de problème
  urgent seulement : `JPA_DDL_AUTO=update`. `FLYWAY_ENABLED=false` désactive Flyway.
* **Nouvelle évolution de schéma** : ajoutez `V3__description.sql` ; ne modifiez jamais un script déjà appliqué.
* La CI exécute `infrastructure/scripts/check-migrations.py` : migrations rejouées sur PostgreSQL + comparaison entités/colonnes.

## 8. Événements et notifications

| Service | Événements publiés | Destinataires |
|---|---|---|
| case-service, consultation-service | dossier, consultation | avocat, client, acteur |
| appointment-service | création, modification, annulation, **rappel 24 h avant** (une seule fois, rappel remis à zéro si déplacé) | client, avocat, acteur |
| billing-service | facture émise, paiement reçu, **facture en retard** (aussi par la tâche quotidienne) | client, acteur |
| judicial-service | procédure enregistrée, changement de statut, audience créée / changée | acteur uniquement (limite du consommateur) |
| deadline-service | échéance créée, **J-7 / J-3 / J-1**, dépassée | auteur de l'échéance (rôle avocat supposé pour les rappels automatiques), acteur |

Aucun montant, intitulé ou contenu de procédure ne transite par RabbitMQ : seuls des messages génériques et des identifiants.
Les publications ne font jamais échouer l'opération métier (erreur journalisée seulement).

## 9. Sauvegardes et restauration (Kubernetes)

`base/backups.yaml` : un `CronJob` `pg_dump -Fc` par base (10) à 02:00 et un miroir MinIO à 02:30, sur le volume
`legalflow-backups` (50 Gi), rétention 14 jours pour les bases. **Copiez ce volume hors du cluster** (snapshot du fournisseur, rclone…) :
une sauvegarde au même endroit que les données ne protège pas d'une perte du cluster.

Restauration d'une base :
```bash
kubectl -n legalflow run restore --rm -it --image=postgres:17-alpine --overrides='...monter legalflow-backups...' -- \
  pg_restore -h case-db -U case_user -d case_db --clean --if-exists /backup/case-db/case_db-AAAA-MM-JJ.dump
```
(arrêtez d'abord le service concerné : `kubectl -n legalflow scale deploy/case-service --replicas=0`.)

## 10. Secrets Kubernetes

* Simple : `secrets.example.yaml` → `secrets.yaml` (ignoré par git) → `kubectl apply -f`.
* Géré : `kubectl apply -k infrastructure/kubernetes/overlays/external-secrets` (External Secrets Operator + Vault / AWS / GCP / Azure,
  clés lues sous `legalflow/<clé>`). Alternative : Sealed Secrets (`kubeseal < secrets.yaml`).
