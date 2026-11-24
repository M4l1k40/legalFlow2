package com.legalflow.client.integration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;

class UserAccountNameSynchronizerTest {

    private MockRestServiceServer server;
    private UserAccountNameSynchronizer synchronizer;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://user-service:8090");
        server = MockRestServiceServer.bindTo(builder).build();
        synchronizer = new UserAccountNameSynchronizer(builder.build());
        authenticateWithName("Sophie", "Durand");
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sendsTheNewNameWithTheCallerTokenToTheUserService() {
        server.expect(requestTo("http://user-service:8090/users/me/name"))
                .andExpect(method(HttpMethod.PUT))
                .andExpect(header("Authorization", "Bearer caller-token"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"firstName\":\"Sophie\",\"lastName\":\"Martin\"}"))
                .andRespond(withNoContent());

        assertTrue(synchronizer.syncName("Sophie", "Martin"));
        server.verify();
    }

    @Test
    void alwaysSendsTheNameEvenWhenTheTokenClaimLooksIdentical() {
        // le token peut dater d'avant une modification précédente : on ne se fie pas à ses claims
        server.expect(requestTo("http://user-service:8090/users/me/name"))
                .andExpect(content().json("{\"firstName\":\"Sophie\",\"lastName\":\"Durand\"}"))
                .andRespond(withNoContent());

        assertTrue(synchronizer.syncName("Sophie", "Durand"));
        server.verify();
    }

    @Test
    void reportsFailureWithoutThrowingWhenTheUserServiceFails() {
        server.expect(requestTo("http://user-service:8090/users/me/name")).andRespond(withServerError());

        assertFalse(synchronizer.syncName("Sophie", "Martin"));
        server.verify();
    }

    private static void authenticateWithName(String firstName, String lastName) {
        Jwt jwt = Jwt.withTokenValue("caller-token")
                .header("alg", "none")
                .subject("33333333-3333-3333-3333-333333333333")
                .claim("given_name", firstName)
                .claim("family_name", lastName)
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }
}
