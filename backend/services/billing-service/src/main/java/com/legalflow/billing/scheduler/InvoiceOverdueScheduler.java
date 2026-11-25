package com.legalflow.billing.scheduler;

import com.legalflow.billing.domain.Invoice;
import com.legalflow.billing.domain.InvoiceStatus;
import com.legalflow.billing.messaging.InvoiceEventPublisher;
import com.legalflow.billing.repository.InvoiceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class InvoiceOverdueScheduler {

    private final InvoiceRepository invoiceRepository;

    private InvoiceEventPublisher eventPublisher;

    public InvoiceOverdueScheduler(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    @Autowired(required = false)
    public void setEventPublisher(InvoiceEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    @Scheduled(fixedDelayString = "${legalflow.billing.processing-interval-ms:60000}")
    @Transactional
    public void markOverdueInvoices() {
        List<Invoice> staleInvoices = invoiceRepository.findAllByStatusAndDueDateBefore(
                InvoiceStatus.SENT, LocalDate.now());

        for (Invoice invoice : staleInvoices) {
            invoice.setStatus(InvoiceStatus.OVERDUE);
            if (eventPublisher != null) {
                eventPublisher.overdue(invoice);
            }
        }
    }
}
