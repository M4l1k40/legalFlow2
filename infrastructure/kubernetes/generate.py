#!/usr/bin/env python3
"""Génère les manifestes Kubernetes (base kustomize) à partir des fichiers docker-compose.

    python3 infrastructure/kubernetes/generate.py

Les noms de services Kubernetes reprennent ceux de Compose (client-service, case-db, keycloak, rabbitmq...) :
les URL internes des variables d'environnement restent donc identiques. Les mots de passe ne sont jamais écrits dans
les manifestes : ils sont lus dans le Secret `legalflow-secrets` (voir secrets.example.yaml).
"""
import os
import re
import shutil
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
INFRA = os.path.dirname(HERE)
OUT = os.path.join(HERE, "base")
NS = "legalflow"
REGISTRY = "ghcr.io/m4l1k40/lg2"

PORTS = {
    "gateway": 9000, "client-service": 8081, "case-service": 8082, "appointment-service": 8083,
    "judicial-service": 8084, "document-service": 8085, "deadline-service": 8086, "notification-service": 8087,
    "billing-service": 8088, "consultation-service": 8089, "user-service": 8090,
}
EVENT_SERVICES = {"case-service", "consultation-service", "notification-service", "appointment-service", "billing-service", "judicial-service", "deadline-service"}


def load(name):
    with open(os.path.join(INFRA, name)) as handle:
        return yaml.safe_load(handle)


def env_dict(service):
    env = service.get("environment", {})
    if isinstance(env, list):
        env = dict(item.split("=", 1) for item in env)
    return env


def meta(name, **labels):
    return {"name": name, "namespace": NS, "labels": {"app.kubernetes.io/name": name, "app.kubernetes.io/part-of": "legalflow", **labels}}


def secret_ref(key):
    return {"secretKeyRef": {"name": "legalflow-secrets", "key": key}}


def config_ref(key):
    return {"configMapKeyRef": {"name": "legalflow-config", "key": key}}


SECURITY = {
    "runAsNonRoot": True, "allowPrivilegeEscalation": False,
    "capabilities": {"drop": ["ALL"]}, "seccompProfile": {"type": "RuntimeDefault"},
}


def convert_env(svc_name, env):
    out = []
    for key, value in env.items():
        value = str(value)
        if key == "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI":
            out.append({"name": key, "valueFrom": config_ref("KEYCLOAK_ISSUER_URI")})
        elif key == "SPRING_DATASOURCE_PASSWORD":
            out.append({"name": key, "valueFrom": secret_ref(f"{svc_name.replace('-service', '')}-db-password")})
        elif key in ("KEYCLOAK_ADMIN_CLIENT_SECRET", "NOTIFICATION_SERVICE_CLIENT_SECRET", "MAIL_PASSWORD", "WHATSAPP_ACCESS_TOKEN", "MAIL_USERNAME"):
            out.append({"name": key, "valueFrom": secret_ref(key.lower().replace("_", "-"))})
        elif value.startswith("${"):
            out.append({"name": key, "valueFrom": config_ref(key)})
        else:
            out.append({"name": key, "value": value})
    return out


def deployment(name, image, port, env, extra_env=None, probe_path="/actuator/health", replicas=1, resources=None):
    container = {
        "name": name, "image": image, "imagePullPolicy": "IfNotPresent",
        "ports": [{"containerPort": port, "name": "http"}],
        "env": env + (extra_env or []),
        "securityContext": {**SECURITY, "readOnlyRootFilesystem": True},
        "resources": resources or {"requests": {"cpu": "100m", "memory": "384Mi"}, "limits": {"cpu": "1", "memory": "768Mi"}},
        "volumeMounts": [{"name": "tmp", "mountPath": "/tmp"}],
        "readinessProbe": {"httpGet": {"path": probe_path, "port": "http"}, "initialDelaySeconds": 30, "periodSeconds": 10, "failureThreshold": 6},
        "livenessProbe": {"httpGet": {"path": probe_path, "port": "http"}, "initialDelaySeconds": 90, "periodSeconds": 20, "failureThreshold": 5},
    }
    return {
        "apiVersion": "apps/v1", "kind": "Deployment", "metadata": meta(name),
        "spec": {
            "replicas": replicas,
            "selector": {"matchLabels": {"app.kubernetes.io/name": name}},
            "template": {
                "metadata": {"labels": {"app.kubernetes.io/name": name, "app.kubernetes.io/part-of": "legalflow"},
                             "annotations": {"prometheus.io/scrape": "true", "prometheus.io/path": "/actuator/prometheus", "prometheus.io/port": str(port)}},
                "spec": {"securityContext": {"runAsUser": 10001, "runAsGroup": 10001, "fsGroup": 10001},
                         "containers": [container], "volumes": [{"name": "tmp", "emptyDir": {}}]},
            },
        },
    }


def service(name, port, target=None):
    return {"apiVersion": "v1", "kind": "Service", "metadata": meta(name),
            "spec": {"selector": {"app.kubernetes.io/name": name}, "ports": [{"name": "http", "port": port, "targetPort": target or port}]}}


def statefulset(name, image, port, env, mount, size="5Gi", args=None, probe=None, uid=None):
    container = {
        "name": name, "image": image, "ports": [{"containerPort": port}], "env": env,
        "volumeMounts": [{"name": "data", "mountPath": mount}],
        "resources": {"requests": {"cpu": "50m", "memory": "128Mi"}, "limits": {"memory": "512Mi"}},
    }
    if args:
        container["args"] = args
    if probe:
        container["readinessProbe"] = {"exec": {"command": probe}, "initialDelaySeconds": 10, "periodSeconds": 10}
    spec = {
        "serviceName": name, "replicas": 1,
        "selector": {"matchLabels": {"app.kubernetes.io/name": name}},
        "template": {"metadata": {"labels": {"app.kubernetes.io/name": name, "app.kubernetes.io/part-of": "legalflow"}},
                     "spec": {"containers": [container]}},
        "volumeClaimTemplates": [{"metadata": {"name": "data"}, "spec": {"accessModes": ["ReadWriteOnce"], "resources": {"requests": {"storage": size}}}}],
    }
    if uid:
        spec["template"]["spec"]["securityContext"] = {"fsGroup": uid}
    return {"apiVersion": "apps/v1", "kind": "StatefulSet", "metadata": meta(name), "spec": spec}


def dump(filename, docs):
    with open(os.path.join(OUT, filename), "w") as handle:
        handle.write("# GÉNÉRÉ par infrastructure/kubernetes/generate.py — ne pas modifier à la main.\n")
        yaml.safe_dump_all(docs, handle, sort_keys=False, default_flow_style=False)


def main():
    os.makedirs(OUT, exist_ok=True)
    compose = load("docker-compose.yml")["services"]
    compose.update({k: v for k, v in load("docker-compose.user-service.yml")["services"].items() if "build" in v})

    # ---- Namespace, ConfigMap ----
    dump("namespace.yaml", [{"apiVersion": "v1", "kind": "Namespace", "metadata": {"name": NS, "labels": {"pod-security.kubernetes.io/enforce": "baseline"}}}])
    config = {
        "KEYCLOAK_ISSUER_URI": "https://auth.legalflow.example.com/realms/legalflow",
        "LEGALFLOW_FRONTEND_URL": "https://app.legalflow.example.com", "LEGALFLOW_API_URL": "https://api.legalflow.example.com",
        "MAIL_HOST": "smtp.example.com", "MAIL_PORT": "587", "MAIL_FROM": "no-reply@legalflow.example.com",
        "WHATSAPP_MODE": "MOCK", "WHATSAPP_PROVIDER": "META", "WHATSAPP_API_URL": "https://graph.facebook.com/v22.0",
        "WHATSAPP_PHONE_NUMBER_ID": "", "MINIO_BUCKET": "legalflow-documents",
        "DEADLINE_PROCESSING_INTERVAL_MS": "3600000", "BILLING_PROCESSING_INTERVAL_MS": "3600000",
        "DEADLINE_APPROACHING_THRESHOLDS_DAYS": "7,3,1",
    }
    dump("configmap.yaml", [{"apiVersion": "v1", "kind": "ConfigMap", "metadata": meta("legalflow-config"), "data": config}])

    # ---- Bases PostgreSQL (une par service) ----
    db_docs, db_secret_keys = [], []
    for name, svc in compose.items():
        if not str(svc.get("image", "")).startswith("postgres"):
            continue
        env = env_dict(svc)
        base = "client" if name == "postgres" else name.replace("-db", "")
        key = f"{base}-db-password"
        db_secret_keys.append(key)
        db_env = [{"name": "POSTGRES_DB", "value": env["POSTGRES_DB"]}, {"name": "POSTGRES_USER", "value": env["POSTGRES_USER"]},
                  {"name": "POSTGRES_PASSWORD", "valueFrom": secret_ref(key)}, {"name": "PGDATA", "value": "/var/lib/postgresql/data/pgdata"}]
        k8s_name = "postgres" if name == "postgres" else name
        db_docs += [statefulset(k8s_name, "postgres:17-alpine", 5432, db_env, "/var/lib/postgresql/data",
                                probe=["pg_isready", "-U", env["POSTGRES_USER"], "-d", env["POSTGRES_DB"]], uid=70),
                    service(k8s_name, 5432)]
    dump("databases.yaml", db_docs)

    # ---- Keycloak (+ sa base), RabbitMQ, MinIO ----
    kc_env = [
        {"name": "KC_DB", "value": "postgres"}, {"name": "KC_DB_URL", "value": "jdbc:postgresql://keycloak-db:5432/keycloak"},
        {"name": "KC_DB_USERNAME", "value": "keycloak"}, {"name": "KC_DB_PASSWORD", "valueFrom": secret_ref("keycloak-db-password")},
        {"name": "KC_HTTP_ENABLED", "value": "true"}, {"name": "KC_PROXY_HEADERS", "value": "xforwarded"},
        {"name": "KC_HOSTNAME", "valueFrom": config_ref("KEYCLOAK_ISSUER_URI")}, {"name": "KC_HEALTH_ENABLED", "value": "true"},
        {"name": "LEGALFLOW_FRONTEND_URL", "valueFrom": config_ref("LEGALFLOW_FRONTEND_URL")},
        {"name": "LEGALFLOW_API_URL", "valueFrom": config_ref("LEGALFLOW_API_URL")},
        {"name": "KC_SECRET_LEGALFLOW_GATEWAY", "valueFrom": secret_ref("kc-secret-legalflow-gateway")},
        {"name": "KEYCLOAK_ADMIN", "valueFrom": secret_ref("keycloak-admin-user")},
        {"name": "KEYCLOAK_ADMIN_PASSWORD", "valueFrom": secret_ref("keycloak-admin-password")},
    ]
    keycloak = deployment("keycloak", "quay.io/keycloak/keycloak:26.0.7", 8080, kc_env, probe_path="/health/ready",
                          resources={"requests": {"cpu": "250m", "memory": "768Mi"}, "limits": {"memory": "1536Mi"}})
    kc_container = keycloak["spec"]["template"]["spec"]["containers"][0]
    kc_container["args"] = ["start", "--import-realm"]
    kc_container["securityContext"]["readOnlyRootFilesystem"] = False
    kc_container["volumeMounts"].append({"name": "realm", "mountPath": "/opt/keycloak/data/import"})
    kc_container["readinessProbe"]["httpGet"]["port"] = 9000 if False else "http"
    keycloak["spec"]["template"]["spec"]["volumes"].append({"name": "realm", "configMap": {"name": "legalflow-realm"}})
    keycloak["spec"]["template"]["metadata"]["annotations"] = {}
    kc_db_env = [{"name": "POSTGRES_DB", "value": "keycloak"}, {"name": "POSTGRES_USER", "value": "keycloak"},
                 {"name": "POSTGRES_PASSWORD", "valueFrom": secret_ref("keycloak-db-password")}, {"name": "PGDATA", "value": "/var/lib/postgresql/data/pgdata"}]
    rabbit_env = [{"name": "RABBITMQ_DEFAULT_USER", "value": "legalflow"}, {"name": "RABBITMQ_DEFAULT_PASS", "valueFrom": secret_ref("rabbitmq-password")}]
    minio_env = [{"name": "MINIO_ROOT_USER", "valueFrom": secret_ref("minio-root-user")}, {"name": "MINIO_ROOT_PASSWORD", "valueFrom": secret_ref("minio-root-password")}]
    minio = statefulset("minio", "minio/minio:RELEASE.2025-04-22T22-12-26Z", 9000, minio_env, "/data", size="20Gi",
                        args=["server", "/data", "--console-address", ":9001"])
    minio["spec"]["template"]["spec"]["containers"][0]["readinessProbe"] = {"httpGet": {"path": "/minio/health/ready", "port": 9000}, "periodSeconds": 10}
    infra = [
        statefulset("keycloak-db", "postgres:17-alpine", 5432, kc_db_env, "/var/lib/postgresql/data", probe=["pg_isready", "-U", "keycloak"], uid=70), service("keycloak-db", 5432),
        keycloak, service("keycloak", 8080),
        statefulset("rabbitmq", "rabbitmq:4.1-management-alpine", 5672, rabbit_env, "/var/lib/rabbitmq", size="2Gi",
                    probe=["rabbitmq-diagnostics", "-q", "ping"], uid=999),
        {**service("rabbitmq", 5672), "spec": {"selector": {"app.kubernetes.io/name": "rabbitmq"}, "ports": [{"name": "amqp", "port": 5672}]}},
        minio, {**service("minio", 9000)},
    ]
    dump("infrastructure.yaml", infra)

    # ---- Services applicatifs ----
    apps = []
    for name, port in PORTS.items():
        svc = compose[name]
        env = env_dict(svc)
        extra = []
        if name in EVENT_SERVICES:
            extra += [{"name": "RABBITMQ_HOST", "value": "rabbitmq"}, {"name": "SPRING_RABBITMQ_HOST", "value": "rabbitmq"},
                      {"name": "SPRING_RABBITMQ_USERNAME", "value": "legalflow"}, {"name": "SPRING_RABBITMQ_PASSWORD", "valueFrom": secret_ref("rabbitmq-password")}]
        if name == "document-service":
            extra += [{"name": "MINIO_ENDPOINT", "value": "http://minio:9000"}, {"name": "MINIO_ACCESS_KEY", "valueFrom": secret_ref("minio-root-user")},
                      {"name": "MINIO_SECRET_KEY", "valueFrom": secret_ref("minio-root-password")}, {"name": "MINIO_BUCKET", "valueFrom": config_ref("MINIO_BUCKET")}]
        apps += [deployment(name, f"{REGISTRY}/{name}:latest", port, convert_env(name, env), extra, replicas=2 if name == "gateway" else 1), service(name, port)]

    apps += [
        {**deployment("frontend", f"{REGISTRY}/frontend:latest", 8080, [], probe_path="/healthz",
                      resources={"requests": {"cpu": "20m", "memory": "32Mi"}, "limits": {"memory": "128Mi"}}, replicas=2), },
        service("frontend", 8080),
    ]
    for doc in apps:
        if doc["kind"] == "Deployment" and doc["metadata"]["name"] == "frontend":
            doc["spec"]["template"]["metadata"]["annotations"] = {}
            c = doc["spec"]["template"]["spec"]["containers"][0]
            c["readinessProbe"]["initialDelaySeconds"] = 3
            c["livenessProbe"]["initialDelaySeconds"] = 10
            doc["spec"]["template"]["spec"]["securityContext"] = {"runAsUser": 101, "runAsGroup": 101}
            c["volumeMounts"] = [{"name": "tmp", "mountPath": "/tmp"}]
    dump("applications.yaml", apps)

    # ---- Ingress, NetworkPolicy, HPA, PDB ----
    ingress_annotations = {
        "cert-manager.io/cluster-issuer": "letsencrypt-prod",
        "nginx.ingress.kubernetes.io/proxy-body-size": "26m",
        "nginx.ingress.kubernetes.io/limit-rps": "20",           # SEC-17 : limitation de débit par IP
        "nginx.ingress.kubernetes.io/limit-burst-multiplier": "5",
        "nginx.ingress.kubernetes.io/limit-connections": "40",
    }

    def rule(host, svc, port):
        return {"host": host, "http": {"paths": [{"path": "/", "pathType": "Prefix", "backend": {"service": {"name": svc, "port": {"number": port}}}}]}}

    ingress = {"apiVersion": "networking.k8s.io/v1", "kind": "Ingress", "metadata": {**meta("legalflow"), "annotations": ingress_annotations},
               "spec": {"ingressClassName": "nginx",
                        "tls": [{"hosts": ["app.legalflow.example.com", "api.legalflow.example.com", "auth.legalflow.example.com"], "secretName": "legalflow-tls"}],
                        "rules": [rule("app.legalflow.example.com", "frontend", 8080), rule("api.legalflow.example.com", "gateway", 9000),
                                  rule("auth.legalflow.example.com", "keycloak", 8080)]}}
    netpol = [
        {"apiVersion": "networking.k8s.io/v1", "kind": "NetworkPolicy", "metadata": meta("default-deny-ingress"),
         "spec": {"podSelector": {}, "policyTypes": ["Ingress"]}},
        {"apiVersion": "networking.k8s.io/v1", "kind": "NetworkPolicy", "metadata": meta("allow-same-namespace"),
         "spec": {"podSelector": {}, "policyTypes": ["Ingress"], "ingress": [{"from": [{"podSelector": {}}]}]}},
        {"apiVersion": "networking.k8s.io/v1", "kind": "NetworkPolicy", "metadata": meta("allow-ingress-controller"),
         "spec": {"podSelector": {"matchExpressions": [{"key": "app.kubernetes.io/name", "operator": "In", "values": ["frontend", "gateway", "keycloak"]}]},
                  "policyTypes": ["Ingress"],
                  "ingress": [{"from": [{"namespaceSelector": {"matchLabels": {"kubernetes.io/metadata.name": "ingress-nginx"}}}]}]}},
    ]
    hpa = [{"apiVersion": "autoscaling/v2", "kind": "HorizontalPodAutoscaler", "metadata": meta(f"{n}-hpa"),
            "spec": {"scaleTargetRef": {"apiVersion": "apps/v1", "kind": "Deployment", "name": n}, "minReplicas": r, "maxReplicas": m,
                     "metrics": [{"type": "Resource", "resource": {"name": "cpu", "target": {"type": "Utilization", "averageUtilization": 70}}}]}}
           for n, r, m in (("gateway", 2, 6), ("frontend", 2, 4))]
    pdb = [{"apiVersion": "policy/v1", "kind": "PodDisruptionBudget", "metadata": meta(f"{n}-pdb"),
            "spec": {"minAvailable": 1, "selector": {"matchLabels": {"app.kubernetes.io/name": n}}}} for n in ("gateway", "frontend")]
    dump("networking.yaml", [ingress] + netpol + hpa + pdb)

    # ---- Monitoring ----
    prom_cfg = open(os.path.join(INFRA, "monitoring", "prometheus.yml")).read()
    graf_ds = open(os.path.join(INFRA, "monitoring/grafana/provisioning/datasources/prometheus.yml")).read().replace("http://prometheus:9090", "http://prometheus:9090")
    mon = [
        {"apiVersion": "v1", "kind": "ConfigMap", "metadata": meta("prometheus-config"),
         "data": {"prometheus.yml": prom_cfg, "alerts.yml": open(os.path.join(INFRA, "monitoring", "alerts.yml")).read()}},
        {"apiVersion": "v1", "kind": "ConfigMap", "metadata": meta("grafana-provisioning"),
         "data": {"datasource.yml": graf_ds, "dashboards.yml": open(os.path.join(INFRA, "monitoring/grafana/provisioning/dashboards/legalflow.yml")).read()}},
        {"apiVersion": "v1", "kind": "ConfigMap", "metadata": meta("grafana-dashboards"),
         "data": {"legalflow-overview.json": open(os.path.join(INFRA, "monitoring/grafana/dashboards/legalflow-overview.json")).read()}},
    ]
    prom = deployment("prometheus", "prom/prometheus:v3.3.1", 9090, [], probe_path="/-/ready",
                      resources={"requests": {"cpu": "100m", "memory": "256Mi"}, "limits": {"memory": "1Gi"}})
    pc = prom["spec"]["template"]["spec"]["containers"][0]
    pc["args"] = ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--storage.tsdb.retention.time=15d"]
    pc["volumeMounts"] += [{"name": "config", "mountPath": "/etc/prometheus"}]
    prom["spec"]["template"]["spec"]["volumes"] += [{"name": "config", "configMap": {"name": "prometheus-config"}}]
    prom["spec"]["template"]["metadata"]["annotations"] = {}
    prom["spec"]["template"]["spec"]["securityContext"] = {"runAsUser": 65534, "runAsGroup": 65534, "fsGroup": 65534}
    graf = deployment("grafana", "grafana/grafana:11.6.1", 3000, [
        {"name": "GF_SECURITY_ADMIN_USER", "valueFrom": secret_ref("grafana-admin-user")},
        {"name": "GF_SECURITY_ADMIN_PASSWORD", "valueFrom": secret_ref("grafana-admin-password")},
        {"name": "GF_USERS_ALLOW_SIGN_UP", "value": "false"}], probe_path="/api/health",
        resources={"requests": {"cpu": "50m", "memory": "128Mi"}, "limits": {"memory": "512Mi"}})
    gc = graf["spec"]["template"]["spec"]["containers"][0]
    gc["securityContext"]["readOnlyRootFilesystem"] = False
    gc["volumeMounts"] += [{"name": "prov", "mountPath": "/etc/grafana/provisioning/datasources/datasource.yml", "subPath": "datasource.yml"},
                           {"name": "prov", "mountPath": "/etc/grafana/provisioning/dashboards/dashboards.yml", "subPath": "dashboards.yml"},
                           {"name": "dash", "mountPath": "/var/lib/grafana/dashboards"}]
    graf["spec"]["template"]["spec"]["volumes"] += [{"name": "prov", "configMap": {"name": "grafana-provisioning"}},
                                                    {"name": "dash", "configMap": {"name": "grafana-dashboards"}}]
    graf["spec"]["template"]["metadata"]["annotations"] = {}
    graf["spec"]["template"]["spec"]["securityContext"] = {"runAsUser": 472, "runAsGroup": 472, "fsGroup": 472}
    dump("monitoring.yaml", mon + [prom, service("prometheus", 9090), graf, service("grafana", 3000)])

    # ---- Sauvegardes : pg_dump quotidien de chaque base + miroir MinIO, rétention 14 jours ----
    backup_docs = [{"apiVersion": "v1", "kind": "PersistentVolumeClaim", "metadata": meta("legalflow-backups"),
                    "spec": {"accessModes": ["ReadWriteOnce"], "resources": {"requests": {"storage": "50Gi"}}}}]
    dbs = [("postgres", "client", "legalflow", "legalflow"), ("keycloak-db", "keycloak", "keycloak", "keycloak")]
    for name, svc in compose.items():
        if str(svc.get("image", "")).startswith("postgres") and name != "postgres":
            e = env_dict(svc)
            dbs.append((name, name.replace("-db", ""), e["POSTGRES_USER"], e["POSTGRES_DB"]))
    # (hôte, clé de secret, utilisateur, base)
    dbs[0] = ("postgres", "client", compose["postgres"]["environment"]["POSTGRES_USER"], compose["postgres"]["environment"]["POSTGRES_DB"])

    def cronjob(name, image, command, env, schedule):
        return {"apiVersion": "batch/v1", "kind": "CronJob", "metadata": meta(name),
                "spec": {"schedule": schedule, "concurrencyPolicy": "Forbid", "successfulJobsHistoryLimit": 3, "failedJobsHistoryLimit": 3,
                         "jobTemplate": {"spec": {"backoffLimit": 2, "template": {"spec": {
                             "restartPolicy": "OnFailure",
                             "securityContext": {"runAsUser": 70, "runAsGroup": 70, "fsGroup": 70},
                             "containers": [{"name": "backup", "image": image, "command": ["sh", "-c", command], "env": env,
                                             "volumeMounts": [{"name": "backups", "mountPath": "/backup"}],
                                             "resources": {"requests": {"cpu": "50m", "memory": "64Mi"}, "limits": {"memory": "256Mi"}}}],
                             "volumes": [{"name": "backups", "persistentVolumeClaim": {"claimName": "legalflow-backups"}}]}}}}}}

    for host, key, user, dbname in dbs:
        cmd = (f"set -e; mkdir -p /backup/{host}; pg_dump -h {host} -U {user} -d {dbname} -Fc -f /backup/{host}/{dbname}-$(date +%F).dump; "
               f"find /backup/{host} -name '*.dump' -mtime +14 -delete")
        backup_docs.append(cronjob(f"backup-{host}", "postgres:17-alpine", cmd,
                                   [{"name": "PGPASSWORD", "valueFrom": secret_ref(f"{key}-db-password")}], "0 2 * * *"))
    backup_docs.append(cronjob(
        "backup-minio", "minio/mc:latest",   # à épingler sur une version précise en production
        "set -e; mc alias set src http://minio:9000 \"$MINIO_USER\" \"$MINIO_PASS\"; "
        "mc mirror --overwrite --remove src/legalflow-documents /backup/minio",
        [{"name": "MINIO_USER", "valueFrom": secret_ref("minio-root-user")}, {"name": "MINIO_PASS", "valueFrom": secret_ref("minio-root-password")}],
        "30 2 * * *"))
    dump("backups.yaml", backup_docs)

    # ---- Secret d'exemple (hors kustomization) ----
    keys = sorted(set(db_secret_keys + ["keycloak-db-password", "keycloak-admin-user", "keycloak-admin-password", "rabbitmq-password",
                                        "minio-root-user", "minio-root-password", "keycloak-admin-client-secret", "notification-service-client-secret", "kc-secret-legalflow-gateway",
                                        "mail-username", "mail-password", "whatsapp-access-token", "grafana-admin-user", "grafana-admin-password"]))
    with open(os.path.join(HERE, "secrets.example.yaml"), "w") as handle:
        handle.write("# MODÈLE — copiez ce fichier en secrets.yaml, remplacez chaque valeur par un secret fort, NE COMMITEZ JAMAIS secrets.yaml.\n"
                     "# Génération : openssl rand -base64 32\n")
        yaml.safe_dump({"apiVersion": "v1", "kind": "Secret", "metadata": {"name": "legalflow-secrets", "namespace": NS}, "type": "Opaque",
                        "stringData": {k: "REPLACE_ME" for k in keys}}, handle, sort_keys=False)

    # Realm de production (sans utilisateurs de test, sans grant password, secrets lus dans l'environnement).
    import sys
    sys.path.insert(0, os.path.join(INFRA, "keycloak"))
    import make_prod_realm
    make_prod_realm.write(os.path.join(OUT, "legalflow-realm.json"))
    with open(os.path.join(OUT, "kustomization.yaml"), "w") as handle:
        handle.write("""apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: legalflow
resources:
  - namespace.yaml
  - configmap.yaml
  - databases.yaml
  - infrastructure.yaml
  - applications.yaml
  - monitoring.yaml
  - networking.yaml
  - backups.yaml
configMapGenerator:
  - name: legalflow-realm
    files:
      - legalflow-realm.json
generatorOptions:
  disableNameSuffixHash: true
# Remplacez le tag `latest` par le SHA/version publié par le workflow CD (cd.yml).
images:
""" + "".join(f"  - name: {REGISTRY}/{n}\n    newTag: latest\n" for n in list(PORTS) + ["frontend"]))
    print("OK:", len(os.listdir(OUT)), "fichiers générés dans", OUT)


if __name__ == "__main__":
    main()
