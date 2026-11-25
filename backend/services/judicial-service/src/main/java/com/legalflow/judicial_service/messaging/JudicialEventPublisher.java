package com.legalflow.judicial_service.messaging;

import com.legalflow.events.DomainEventEnvelope;
import com.legalflow.events.DomainEventPublisher;
import com.legalflow.events.EventActors;
import com.legalflow.events.EventRecipient;
import com.legalflow.events.EventTypes;
import com.legalflow.judicial_service.domain.JudicialCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Publie les événements du domaine « judiciaire ». Le consommateur ne prévoit que l'acteur comme destinataire :
 * sans acteur notifiable (administrateur, appel technique) rien n'est publié.
 * Ne fait jamais échouer l'opération métier ; aucun détail de procédure ne transite par le broker.
 */
@Component
public class JudicialEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(JudicialEventPublisher.class);
    private static final String SOURCE = "judicial-service";

    private final DomainEventPublisher domainEventPublisher;

    public JudicialEventPublisher(DomainEventPublisher domainEventPublisher) {
        this.domainEventPublisher = domainEventPublisher;
    }

    public void caseRegistered(JudicialCase judicialCase) {
        publish(EventTypes.JUDICIAL_CASE_REGISTERED, judicialCase, "Une procédure judiciaire a été enregistrée.");
    }

    public void caseStatusChanged(JudicialCase judicialCase) {
        publish(EventTypes.JUDICIAL_STATUS_CHANGED, judicialCase, "Le statut d'une procédure judiciaire a changé.");
    }

    public void hearingCreated(JudicialCase judicialCase) {
        publish(EventTypes.HEARING_CREATED, judicialCase, "Une audience a été planifiée.");
    }

    public void hearingStatusChanged(JudicialCase judicialCase) {
        publish(EventTypes.HEARING_STATUS_CHANGED, judicialCase, "Le statut d'une audience a changé.");
    }

    private void publish(String eventType, JudicialCase judicialCase, String message) {
        try {
            UUID lawFirmId = judicialCase.getLawFirmId();
            EventRecipient actor = EventActors.currentActor(lawFirmId);
            if (actor == null) {
                return;
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("actor", actor);
            payload.put("message", message);
            domainEventPublisher.publish(DomainEventEnvelope.of(eventType, lawFirmId, SOURCE, "JUDICIAL_CASE",
                    judicialCase.getId(), payload));
        } catch (RuntimeException exception) {
            log.error("Could not publish {} for judicial case {}", eventType, judicialCase.getId(), exception);
        }
    }
}
