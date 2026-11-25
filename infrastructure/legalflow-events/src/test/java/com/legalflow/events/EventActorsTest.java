package com.legalflow.events;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class EventActorsTest {

    private static final UUID FIRM = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID SUB = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID CLIENT = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private static void login(String role, UUID clientId) {
        Jwt.Builder builder = Jwt.withTokenValue("t").header("alg", "none").subject(SUB.toString())
                .claim("name", "Jane Doe").claim("email", "jane@example.test");
        if (clientId != null) {
            builder.claim("clientId", clientId.toString());
        }
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(builder.build(), List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void lawyerActorUsesKeycloakSub() {
        login("LAWYER", null);
        EventRecipient actor = EventActors.currentActor(FIRM);
        assertNotNull(actor);
        assertEquals(SUB, actor.recipientId());
        assertEquals(EventRecipient.LAWYER, actor.recipientRole());
        assertEquals("jane@example.test", actor.email());
    }

    @Test
    void clientActorUsesClientIdClaim() {
        login("CLIENT", CLIENT);
        EventRecipient actor = EventActors.currentActor(FIRM);
        assertNotNull(actor);
        assertEquals(CLIENT, actor.recipientId());
        assertEquals(EventRecipient.CLIENT, actor.recipientRole());
    }

    @Test
    void clientWithoutClientIdClaimIsNotNotifiable() {
        login("CLIENT", null);
        assertNull(EventActors.currentActor(FIRM));
    }

    @Test
    void adminAndAnonymousAreNotNotifiable() {
        login("ADMIN", null);
        assertNull(EventActors.currentActor(FIRM));
        SecurityContextHolder.clearContext();
        assertNull(EventActors.currentActor(FIRM));
    }

    @Test
    void clientRecipientReusesContactDetailsOnlyForTheSameClient() {
        login("CLIENT", CLIENT);
        EventRecipient actor = EventActors.currentActor(FIRM);
        assertEquals("jane@example.test", EventActors.clientRecipient(CLIENT, FIRM, actor).email());
        assertNull(EventActors.clientRecipient(UUID.randomUUID(), FIRM, actor).email());
        assertNull(EventActors.clientRecipient(CLIENT, FIRM, null).email());
    }

    @Test
    void lawyerRecipientReusesContactDetailsOnlyForTheSameLawyer() {
        login("LAWYER", null);
        EventRecipient actor = EventActors.currentActor(FIRM);
        assertEquals("jane@example.test", EventActors.lawyerRecipient(SUB, FIRM, actor).email());
        assertNull(EventActors.lawyerRecipient(UUID.randomUUID(), FIRM, actor).email());
    }
}
