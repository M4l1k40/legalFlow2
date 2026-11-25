package com.legalflow.appointment.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Vérifie auprès du {@code user-service} qu'un identifiant d'avocat existe bien <b>dans le cabinet de l'appelant</b>
 * (l'annuaire est filtré par cabinet côté serveur d'après le jeton). Le jeton de l'appelant est relayé tel quel.
 */
@Component
public class LawyerDirectoryVerifier {

    private final RestClient userServiceRestClient;

    public LawyerDirectoryVerifier(
            @org.springframework.beans.factory.annotation.Qualifier("userServiceRestClient") RestClient userServiceRestClient) {
        this.userServiceRestClient = userServiceRestClient;
    }

    /** @throws ResponseStatusException 422 si l'avocat est inconnu du cabinet, 503 si l'annuaire est injoignable */
    public void verifyLawyersBelongToCurrentTenant(Collection<UUID> lawyerIds) {
        if (lawyerIds == null || lawyerIds.isEmpty()) {
            return;
        }
        Set<String> known = fetchLawyerIds();
        for (UUID lawyerId : lawyerIds) {
            if (lawyerId == null || !known.contains(lawyerId.toString())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "lawyer not found in your law firm");
            }
        }
    }

    public void verifyLawyerBelongsToCurrentTenant(UUID lawyerId) {
        verifyLawyersBelongToCurrentTenant(lawyerId == null ? List.of() : List.of(lawyerId));
        if (lawyerId == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "lawyer not found in your law firm");
        }
    }

    private Set<String> fetchLawyerIds() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing authenticated JWT.");
        }
        try {
            List<Map<String, Object>> lawyers = userServiceRestClient.get()
                    .uri("/users/lawyers")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtAuthentication.getToken().getTokenValue())
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {
                    });
            if (lawyers == null) {
                return Set.of();
            }
            return lawyers.stream().map(lawyer -> String.valueOf(lawyer.get("id"))).collect(Collectors.toSet());
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "User service could not verify the lawyer.");
        }
    }

    @Configuration
    static class UserServiceRestClientConfiguration {

        @Bean("userServiceRestClient")
        RestClient userServiceRestClient(@Value("${USER_SERVICE_URL:http://user-service:8090}") String baseUrl) {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(Duration.ofSeconds(3));
            requestFactory.setReadTimeout(Duration.ofSeconds(3));
            return RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
        }
    }
}
