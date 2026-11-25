package com.legalflow.appointment.messaging;

import com.legalflow.appointment.domain.Appointment;
import com.legalflow.events.DomainEventEnvelope;
import com.legalflow.events.DomainEventPublisher;
import com.legalflow.events.EventActors;
import com.legalflow.events.EventRecipient;
import com.legalflow.events.EventTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publie les événements du domaine « rendez-vous » (client et avocat concernés, plus l'acteur).
 * Ne fait jamais échouer l'opération métier : toute erreur est journalisée et l'événement est simplement perdu.
 * Les messages sont volontairement génériques (aucune donnée sensible ne transite par le broker).
 */
@Component
public class AppointmentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AppointmentEventPublisher.class);
    private static final String SOURCE = "appointment-service";

    private final DomainEventPublisher domainEventPublisher;

    public AppointmentEventPublisher(DomainEventPublisher domainEventPublisher) {
        this.domainEventPublisher = domainEventPublisher;
    }

    public void created(Appointment appointment) {
        publish(EventTypes.APPOINTMENT_CREATED, appointment, "Un rendez-vous a été planifié.");
    }

    public void updated(Appointment appointment) {
        publish(EventTypes.APPOINTMENT_UPDATED, appointment, "Un rendez-vous a été modifié.");
    }

    public void reminder(Appointment appointment) {
        publish(EventTypes.APPOINTMENT_REMINDER, appointment, "Rappel : vous avez un rendez-vous dans les prochaines 24 heures.");
    }

    public void cancelled(Appointment appointment) {
        publish(EventTypes.APPOINTMENT_CANCELLED, appointment, "Un rendez-vous a été annulé.");
    }

    private void publish(String eventType, Appointment appointment, String message) {
        try {
            UUID lawFirmId = appointment.getLawFirmId();
            EventRecipient actor = EventActors.currentActor(lawFirmId);
            Map<String, Object> payload = new HashMap<>();
            if (actor != null) {
                payload.put("actor", actor);
            }
            payload.put("client", EventActors.clientRecipient(appointment.getClientId(), lawFirmId, actor));
            payload.put("lawyer", EventActors.lawyerRecipient(appointment.getLawyerId(), lawFirmId, actor));
            send(eventType, lawFirmId, "APPOINTMENT", appointment.getId(), payload, message);
        } catch (RuntimeException exception) {
            log.error("Could not publish {} for appointment {}", eventType, appointment.getId(), exception);
        }
    }

    private void send(String eventType, UUID lawFirmId, String aggregateType, UUID aggregateId,
                      Map<String, Object> payload, String message) {
        try {
            payload.put("message", message);
            domainEventPublisher.publish(DomainEventEnvelope.of(eventType, lawFirmId, SOURCE, aggregateType,
                    aggregateId, payload));
        } catch (RuntimeException exception) {
            log.error("Could not publish {} for {} {}", eventType, aggregateType, aggregateId, exception);
        }
    }
}
