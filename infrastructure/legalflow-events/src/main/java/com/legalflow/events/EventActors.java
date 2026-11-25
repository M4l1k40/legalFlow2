package com.legalflow.events;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.UUID;

/**
 * Construit les {@link EventRecipient} à partir de l'utilisateur connecté. Mutualise ce que chaque publisher
 * répétait : retrouver l'acteur depuis le JWT, puis rattacher client / avocat en réutilisant ses coordonnées
 * quand c'est lui-même (sinon le destinataire est rattaché sans email, le notification-service complète).
 *
 * <p>Convention (SEC-07) : {@code clientId} du token pour un CLIENT, {@code sub} Keycloak pour le personnel.
 */
public final class EventActors {

    private EventActors() {
    }

    /** L'utilisateur connecté, ou {@code null} s'il n'est pas notifiable (ADMIN, pas de JWT, identifiant invalide). */
    public static EventRecipient currentActor(UUID lawFirmId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            return null;
        }
        Jwt jwt = jwtAuthentication.getToken();
        String name = firstNonBlank(jwt.getClaimAsString("name"), jwt.getClaimAsString("preferred_username"));
        String email = jwt.getClaimAsString("email");
        if (hasAuthority(authentication, "ROLE_CLIENT")) {
            UUID clientId = parseUuid(jwt.getClaimAsString("clientId"));
            return clientId == null ? null : EventRecipient.client(clientId, lawFirmId, name, email, null);
        }
        UUID sub = parseUuid(jwt.getSubject());
        if (sub == null) {
            return null;
        }
        if (hasAuthority(authentication, "ROLE_LAWYER")) {
            return EventRecipient.lawyer(sub, lawFirmId, name, email, null);
        }
        if (hasAuthority(authentication, "ROLE_SECRETARY")) {
            return EventRecipient.secretary(sub, lawFirmId, name, email, null);
        }
        return null;
    }

    /** Le client {@code clientId} ; ses coordonnées sont reprises si c'est lui l'acteur. */
    public static EventRecipient clientRecipient(UUID clientId, UUID lawFirmId, EventRecipient actor) {
        if (actor != null && EventRecipient.CLIENT.equals(actor.recipientRole()) && clientId.equals(actor.recipientId())) {
            return EventRecipient.client(clientId, lawFirmId, actor.name(), actor.email(), actor.phone());
        }
        return EventRecipient.client(clientId, lawFirmId, null, null, null);
    }

    /** L'avocat dont le {@code sub} Keycloak est {@code lawyerId} ; ses coordonnées sont reprises si c'est lui l'acteur. */
    public static EventRecipient lawyerRecipient(UUID lawyerId, UUID lawFirmId, EventRecipient actor) {
        if (actor != null && EventRecipient.LAWYER.equals(actor.recipientRole()) && lawyerId.equals(actor.recipientId())) {
            return EventRecipient.lawyer(lawyerId, lawFirmId, actor.name(), actor.email(), actor.phone());
        }
        return EventRecipient.lawyer(lawyerId, lawFirmId, null, null, null);
    }

    private static boolean hasAuthority(Authentication authentication, String authority) {
        for (GrantedAuthority granted : authentication.getAuthorities()) {
            if (authority.equals(granted.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    private static UUID parseUuid(String value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }
}
