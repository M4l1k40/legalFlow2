package com.legalflow.client.integration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Recopie le prénom et le nom du client vers son compte Keycloak, via le user-service (seul service qui parle à
 * Keycloak). L'appel utilise le token du client connecté : le user-service met à jour uniquement le compte de ce token.
 *
 * Meilleur effort : la fiche client est déjà enregistrée, un échec ne doit pas faire échouer la modification.
 * Le journal ne contient aucune donnée personnelle (ni nom ni email).
 */
@Component
public class UserAccountNameSynchronizer {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserAccountNameSynchronizer.class);

    private final RestClient restClient;

    public UserAccountNameSynchronizer(@Qualifier("userServiceRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    /**
     * Toujours envoyé, même si le nom du token semble identique : le token peut dater d'avant une modification
     * précédente et ne reflète pas forcément l'état actuel de Keycloak.
     *
     * @return true si Keycloak a été mis à jour, false si la synchronisation a échoué.
     */
    public boolean syncName(String firstName, String lastName) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            return false;
        }
        Jwt jwt = jwtAuthentication.getToken();
        try {
            restClient.put()
                    .uri("/users/me/name")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.getTokenValue())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("firstName", firstName, "lastName", lastName))
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException exception) {
            LOGGER.warn("Could not synchronize the client name to the Keycloak account ({}). The client record is saved.",
                    exception.getClass().getSimpleName());
            return false;
        }
    }
}
