#!/usr/bin/env python3
"""Génère docker-compose.prod.yml à partir des fichiers Compose de base.

    python3 infrastructure/scripts/generate-prod-compose.py

L'overlay produit :
  * SEC-12 : retire la publication des ports de tous les services internes (bases, RabbitMQ, microservices, Mailpit).
             Seuls restent exposés : gateway, keycloak et frontend (à placer derrière un reverse proxy TLS).
  * SEC-13 : remplace chaque secret par une variable OBLIGATOIRE (${VAR:?message}) : le démarrage échoue tant que
             le fichier .env de production ne définit pas de vrais secrets.
Nécessite Docker Compose >= 2.24 (balise !reset).
"""
import os
import re
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
INFRA = os.path.dirname(HERE)
KEEP_PORTS = {"gateway", "keycloak", "frontend"}


class Reset(list):
    """Liste vide sérialisée avec la balise YAML !reset (supprime la valeur héritée)."""


yaml.add_representer(Reset, lambda dumper, data: dumper.represent_sequence("!reset", []))


def load(name):
    with open(os.path.join(INFRA, name)) as handle:
        return yaml.safe_load(handle)["services"]


def env_of(service):
    env = service.get("environment", {}) or {}
    return dict(item.split("=", 1) for item in env) if isinstance(env, list) else dict(env)


def required(var, why):
    return "${%s:?%s}" % (var, why)


def main():
    import subprocess, sys
    subprocess.run([sys.executable, os.path.join(INFRA, "keycloak", "make_prod_realm.py")], check=True)
    services = {}
    for source in ("docker-compose.yml", "docker-compose.user-service.yml", "docker-compose.platform.yml"):
        for name, svc in load(source).items():
            merged = services.setdefault(name, {})
            for key, value in svc.items():
                if key == "environment":
                    merged["environment"] = {**env_of(merged), **env_of(svc)}
                elif key == "ports":
                    merged["ports"] = list(merged.get("ports", [])) + list(value)
                else:
                    merged[key] = value
    out = {}
    for name, svc in services.items():
        overlay = {}
        if svc.get("ports") and name not in KEEP_PORTS:
            overlay["ports"] = Reset()
        env = env_of(svc)
        new_env = {}
        base = "client" if name == "postgres" else name.replace("-service", "").replace("-db", "")
        for key, value in env.items():
            value = str(value)
            if key == "SPRING_DATASOURCE_PASSWORD":
                new_env[key] = required(f"{base.upper()}_DB_PASSWORD", f"definissez {base.upper()}_DB_PASSWORD dans .env")
            elif key == "POSTGRES_PASSWORD":
                new_env[key] = required(f"{base.upper()}_DB_PASSWORD", f"definissez {base.upper()}_DB_PASSWORD dans .env")
            elif key == "KEYCLOAK_ADMIN_PASSWORD":
                new_env[key] = required("KEYCLOAK_ADMIN_PASSWORD", "definissez KEYCLOAK_ADMIN_PASSWORD dans .env")
            elif key == "KEYCLOAK_ADMIN" and name == "keycloak":
                new_env[key] = required("KEYCLOAK_ADMIN_USER", "definissez KEYCLOAK_ADMIN_USER dans .env")
            elif key == "RABBITMQ_DEFAULT_PASS":
                new_env[key] = required("RABBITMQ_DEFAULT_PASS", "definissez RABBITMQ_DEFAULT_PASS dans .env")
            elif key in ("KEYCLOAK_ADMIN_CLIENT_SECRET", "NOTIFICATION_SERVICE_CLIENT_SECRET", "MINIO_ROOT_PASSWORD",
                         "MINIO_SECRET_KEY", "GF_SECURITY_ADMIN_PASSWORD"):
                var = {"MINIO_SECRET_KEY": "MINIO_ROOT_PASSWORD", "GF_SECURITY_ADMIN_PASSWORD": "GRAFANA_ADMIN_PASSWORD"}.get(key, key)
                new_env[key] = required(var, f"definissez {var} dans .env")
        # Les services qui lisent RabbitMQ par RABBITMQ_DEFAULT_PASS ont leur valeur par défaut : on l'impose aussi.
        if name in ("case-service", "consultation-service", "notification-service", "appointment-service",
                    "billing-service", "judicial-service", "deadline-service"):
            new_env["RABBITMQ_DEFAULT_PASS"] = required("RABBITMQ_DEFAULT_PASS", "definissez RABBITMQ_DEFAULT_PASS dans .env")
        if name == "keycloak":
            # Mode production : vraie base PostgreSQL, hostname public, TLS terminé par le reverse proxy.
            new_env = {
                "KC_DB": "postgres",
                "KC_DB_URL": "jdbc:postgresql://keycloak-db:5432/keycloak",
                "KC_DB_USERNAME": "keycloak",
                "KC_DB_PASSWORD": required("KEYCLOAK_DB_PASSWORD", "definissez KEYCLOAK_DB_PASSWORD dans .env"),
                "KC_HOSTNAME": required("KEYCLOAK_PUBLIC_URL", "definissez KEYCLOAK_PUBLIC_URL (https://auth.exemple.com) dans .env"),
                "KC_HTTP_ENABLED": "true",
                "KC_PROXY_HEADERS": "xforwarded",
                "KEYCLOAK_ADMIN": required("KEYCLOAK_ADMIN_USER", "definissez KEYCLOAK_ADMIN_USER dans .env"),
                "KEYCLOAK_ADMIN_PASSWORD": required("KEYCLOAK_ADMIN_PASSWORD", "definissez KEYCLOAK_ADMIN_PASSWORD dans .env"),
                "LEGALFLOW_FRONTEND_URL": required("LEGALFLOW_FRONTEND_URL", "definissez LEGALFLOW_FRONTEND_URL dans .env"),
                "LEGALFLOW_API_URL": required("LEGALFLOW_API_URL", "definissez LEGALFLOW_API_URL dans .env"),
                "KC_SECRET_LEGALFLOW_GATEWAY": required("KC_SECRET_LEGALFLOW_GATEWAY", "definissez KC_SECRET_LEGALFLOW_GATEWAY dans .env"),
            }
            overlay["command"] = ["start", "--import-realm"]
            overlay["depends_on"] = {"keycloak-db": {"condition": "service_healthy"}}
            overlay["volumes"] = ["legalflow_keycloak_data:/opt/keycloak/data", "./keycloak/prod:/opt/keycloak/data/import:ro"]
        if new_env:
            overlay["environment"] = new_env
        if overlay:
            out[name] = overlay
    out["keycloak-db"] = {
        "image": "postgres:17-alpine",
        "container_name": "legalflow-keycloak-db",
        "environment": {"POSTGRES_DB": "keycloak", "POSTGRES_USER": "keycloak",
                        "POSTGRES_PASSWORD": required("KEYCLOAK_DB_PASSWORD", "definissez KEYCLOAK_DB_PASSWORD dans .env")},
        "volumes": ["legalflow_keycloak_db_data:/var/lib/postgresql/data"],
        "healthcheck": {"test": ["CMD-SHELL", "pg_isready -U keycloak -d keycloak"], "interval": "10s", "timeout": "5s", "retries": 10},
        "restart": "unless-stopped",
    }
    path = os.path.join(INFRA, "docker-compose.prod.yml")
    with open(path, "w") as handle:
        handle.write(
            "# GÉNÉRÉ par infrastructure/scripts/generate-prod-compose.py — ne pas modifier à la main.\n"
            "# Production : ports internes non publiés (SEC-12), secrets obligatoires (SEC-13). Compose >= 2.24.\n"
            "#   docker compose -f docker-compose.yml -f docker-compose.user-service.yml -f docker-compose.platform.yml \\\n"
            "#                  -f docker-compose.prod.yml --env-file ../.env.prod up -d --build\n")
        yaml.dump({"services": out, "volumes": {"legalflow_keycloak_db_data": None}}, handle, sort_keys=False,
                  default_flow_style=False, width=10000)
    print("OK:", path, "-", len(out), "services")


if __name__ == "__main__":
    main()
