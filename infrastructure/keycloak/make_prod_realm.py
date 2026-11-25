#!/usr/bin/env python3
"""Construit le realm Keycloak de PRODUCTION à partir du realm de développement.

Différences (SEC-13, SEC-16) :
  * aucun utilisateur de test importé ;
  * le client public `legalflow-frontend` n'autorise plus le grant « password » (les scripts de test ne marchent plus
    en production : c'est voulu, les identifiants ne doivent pas transiter par une application) ;
  * origines / redirections et secrets de clients lus dans l'environnement du conteneur Keycloak
    (substitution ${VARIABLE} faite par Keycloak à l'import) : LEGALFLOW_FRONTEND_URL, KC_SECRET_<CLIENT>.

    python3 infrastructure/keycloak/make_prod_realm.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def build():
    with open(os.path.join(HERE, "legalflow-realm.json"), encoding="utf-8") as handle:
        realm = json.load(handle)
    realm["users"] = []
    realm["sslRequired"] = "external"
    realm["bruteForceProtected"] = True
    realm["failureFactor"] = 5
    realm["permanentLockout"] = False
    realm["maxFailureWaitSeconds"] = 900
    realm["accessTokenLifespan"] = 900
    for client in realm.get("clients", []):
        client_id = client["clientId"]
        if client_id == "legalflow-frontend":
            client["directAccessGrantsEnabled"] = False
            client["redirectUris"] = ["${LEGALFLOW_FRONTEND_URL}/*"]
            client["webOrigins"] = ["${LEGALFLOW_FRONTEND_URL}"]
        if client.get("secret"):
            client["secret"] = "${KC_SECRET_%s}" % re.sub(r"[^A-Za-z0-9]", "_", client_id).upper()
        if client_id == "legalflow-gateway":
            client["redirectUris"] = ["${LEGALFLOW_API_URL}/*"]
    return realm


def write(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(build(), handle, indent=2, ensure_ascii=False)
        handle.write("\n")


if __name__ == "__main__":
    target = os.path.join(HERE, "prod", "legalflow-realm.json")
    write(target)
    print("OK:", target)
