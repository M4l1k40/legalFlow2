package com.legalflow.deadline.notification;

import com.legalflow.deadline.domain.Deadline;
import com.legalflow.events.DomainEventEnvelope;
import com.legalflow.events.DomainEventPublisher;
import com.legalflow.events.EventActors;
import com.legalflow.events.EventRecipient;
import com.legalflow.events.EventTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publie les événements « échéance » sur RabbitMQ (rappels J-7 / J-3 / J-1 et retard, envoyés par le planificateur,
 * plus la création, envoyée par {@code DeadlineService}). Remplace le simple journal comme implémentation principale
 * de {@link NotificationPublisher}.
 *
 * <p>Le planificateur n'a pas d'utilisateur connecté : le destinataire « creator » est l'auteur de l'échéance
 * ({@code createdBy} = {@code sub} Keycloak), rattaché au rôle avocat. Aucun intitulé d'échéance n'est publié.
 */
@Component
@Primary
public class EventNotificationPublisher implements NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventNotificationPublisher.class);
    private static final String SOURCE = "deadline-service";

    private final DomainEventPublisher domainEventPublisher;
    private final LoggingNotificationPublisher fallbackLogger;

    public EventNotificationPublisher(DomainEventPublisher domainEventPublisher, LoggingNotificationPublisher fallbackLogger) {
        this.domainEventPublisher = domainEventPublisher;
        this.fallbackLogger = fallbackLogger;
    }

    @Override
    public void publishOverdue(Deadline deadline) {
        fallbackLogger.publishOverdue(deadline);
        publish(EventTypes.DEADLINE_OVERDUE, deadline, "Une échéance est dépassée.", false);
    }

    @Override
    public void publishApproaching(Deadline deadline, int thresholdDays) {
        fallbackLogger.publishApproaching(deadline, thresholdDays);
        publish(EventTypes.DEADLINE_APPROACHING, deadline, "Une échéance approche (J-" + thresholdDays + ").", false);
    }

    /** Appelé à la création d'une échéance, dans la requête de l'utilisateur (l'acteur est alors connu). */
    public void publishCreated(Deadline deadline) {
        publish(EventTypes.DEADLINE_CREATED, deadline, "Une échéance a été créée.", true);
    }

    private void publish(String eventType, Deadline deadline, String message, boolean withActor) {
        try {
            UUID lawFirmId = deadline.getLawFirmId();
            Map<String, Object> payload = new HashMap<>();
            EventRecipient actor = withActor ? EventActors.currentActor(lawFirmId) : null;
            if (actor != null) {
                payload.put("actor", actor);
            }
            UUID creatorId = parseUuid(deadline.getCreatedBy());
            if (creatorId != null) {
                payload.put("creator", EventActors.lawyerRecipient(creatorId, lawFirmId, actor));
            }
            if (payload.isEmpty()) {
                log.warn("No notifiable recipient for {} on deadline {}", eventType, deadline.getId());
                return;
            }
            payload.put("message", message);
            domainEventPublisher.publish(DomainEventEnvelope.of(eventType, lawFirmId, SOURCE, "DEADLINE",
                    deadline.getId(), payload));
        } catch (RuntimeException exception) {
            log.error("Could not publish {} for deadline {}", eventType, deadline.getId(), exception);
        }
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
}
