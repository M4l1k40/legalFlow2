# Rapport de complétion — état réel (23 novembre 2026)

Référence : rapports `LegalFlow_Etat_Avancement_FR` et `LegalFlow_Rapport_Avancement`, code du dépôt `M4l1k40/lg2`.

## Tout ce qui figurait dans la liste « reste à faire » est maintenant écrit

| Domaine | Livré | Vérifié ici |
|---|---|---|
| Frontend — design et pages | Design system, thème clair/sombre, coque unique, Ctrl+K, connexion, 13 pages remplacées, traduction arabe des titres / sections / libellés / statuts | lint 0 alerte, **73 tests**, build OK |
| Documents | Upload/téléchargement MinIO, clé serveur par cabinet (SEC-11), 9 tests | syntaxe uniquement |
| **Flyway (SEC-14)** | V1 baseline + V2 pour 9 services, `ddl-auto: validate`, garde-fou CI | **scripts exécutés sur un vrai PostgreSQL** + comparaison entités/colonnes (0 écart) |
| **Événements** | Publishers : rendez-vous (+ rappel 24 h), facturation (+ retard), judiciaire, échéances (J-7/3/1, retard, création) ; helper `EventActors` testé ; câblage Docker/CI/CD/K8s | syntaxe uniquement |
| **SEC-09** | Email unique par cabinet | idem |
| **SEC-10** | Tribunaux/juges par cabinet, données partagées en lecture seule, 5 tests | syntaxe uniquement ; **migration exécutée sur PostgreSQL** |
| **SEC-15 / SEC-22** | Avocat vérifié dans l'annuaire du cabinet (rendez-vous, affectation clients) | syntaxe uniquement |
| **SEC-12 / 13 / 16 / 17 / 18** | Compose de production généré (ports internes non publiés, secrets obligatoires), realm Keycloak de prod, limitation de débit à l'Ingress, vérification des journaux | YAML/JSON valides, 79/80 ressources K8s validées |
| Supervision | Prometheus, 4 alertes, Grafana | YAML/JSON valides |
| Kubernetes | 10 PostgreSQL, Keycloak, RabbitMQ, MinIO, 11 services, frontend, Ingress TLS, NetworkPolicies, HPA, PDB, **sauvegardes quotidiennes**, variante External Secrets | **kubeconform** : 79 valides, 0 invalide |
| CI/CD | `ci.yml` (+ jobs `kubernetes` et `migrations`), `cd.yml` (build, Trivy, GHCR, déploiement optionnel) | YAML valide |

## Limites à connaître avant de déployer

1. **Le code Java n'a jamais été compilé** (pas de Maven Central ni de Docker dans mon environnement). Tout a été relu, analysé syntaxiquement
   (0 erreur) et ses appels vérifiés contre le code existant, mais **seule la CI / `mvn verify` en fait foi**. Attendez-vous à corriger
   éventuellement quelques erreurs de compilation ou de test au premier passage, surtout dans : `document-service`, les 4 nouveaux
   publishers, `JudicialService`, `ClientService`, `AppointmentService`.
2. **`ddl-auto: validate`** : mes migrations ont été comparées aux entités par script, pas par Hibernate. Si un service refuse de démarrer avec une
   erreur de schéma, envoyez le message : en attendant, `JPA_DDL_AUTO=update` rétablit l'ancien comportement.
3. **Jamais lancé** : Docker Compose, Kubernetes, rendu visuel du frontend, workflows GitHub.
4. Non vérifiés : substitution `${VAR}` dans l'import du realm Keycloak (sinon éditer `keycloak/prod/legalflow-realm.json`), `mc ready` de MinIO,
   tags d'images tierces (MinIO, Prometheus, Grafana, `minio/mc:latest`).
5. Les tests unitaires de `client-service` (`ClientControllerTest`) ont été adaptés à `existsByLawFirmIdAndEmail`.

## Limites fonctionnelles restantes

| Point | Détail |
|---|---|
| Notifications judiciaires | Seul l'acteur est notifié (le consommateur n'accepte que lui) ; le client n'est pas prévenu d'une audience. |
| Échéances automatiques | Le rappel va à l'auteur de l'échéance en rôle « avocat » : si c'est une secrétaire qui l'a créée, elle ne verra pas la notification dans son rôle. |
| Arabe | Navigation, coque, connexion, paramètres, titres, sections, libellés de formulaires et statuts traduits ; les boutons et textes en dur propres à chaque page restent en français. |
| Paiement en ligne | Hors périmètre : le client consulte ses factures, le règlement se fait au cabinet. |
| Sauvegardes | Le volume de sauvegarde reste dans le cluster : copie hors site à configurer. |
| Limitation de débit en Compose | Non fournie (à placer sur le reverse proxy) ; fournie à l'Ingress Kubernetes. |
