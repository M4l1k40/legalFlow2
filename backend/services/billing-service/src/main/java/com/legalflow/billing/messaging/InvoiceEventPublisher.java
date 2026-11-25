package com.legalflow.billing.messaging;

import com.legalflow.billing.domain.Invoice;
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
 * Publie les événements du domaine « facturation » (client concerné, plus l'acteur). Aucun montant n'est publié.
 * Ne fait jamais échouer l'opération métier : toute erreur est journalisée et l'événement est simplement perdu.
 * Les messages sont volontairement génériques (aucune donnée sensible ne transite par le broker).
 */
@Component
public class InvoiceEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(InvoiceEventPublisher.class);
    private static final String SOURCE = "billing-service";

    private final DomainEventPublisher domainEventPublisher;

    public InvoiceEventPublisher(DomainEventPublisher domainEventPublisher) {
        this.domainEventPublisher = domainEventPublisher;
    }

    /** Facture émise au client (une facture est créée directement au statut « envoyée »). */
    public void issued(Invoice invoice) {
        publish(EventTypes.INVOICE_ISSUED, invoice, "Une nouvelle facture est disponible.");
    }

    public void paid(Invoice invoice) {
        publish(EventTypes.PAYMENT_RECEIVED, invoice, "Un paiement a été enregistré.");
    }

    public void overdue(Invoice invoice) {
        publish(EventTypes.INVOICE_OVERDUE, invoice, "Une facture est en retard de paiement.");
    }

    private void publish(String eventType, Invoice invoice, String message) {
        try {
            UUID lawFirmId = invoice.getLawFirmId();
            EventRecipient actor = EventActors.currentActor(lawFirmId);
            Map<String, Object> payload = new HashMap<>();
            if (actor != null) {
                payload.put("actor", actor);
            }
            payload.put("client", EventActors.clientRecipient(invoice.getClientId(), lawFirmId, actor));
            send(eventType, lawFirmId, "INVOICE", invoice.getId(), payload, message);
        } catch (RuntimeException exception) {
            log.error("Could not publish {} for invoice {}", eventType, invoice.getId(), exception);
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
