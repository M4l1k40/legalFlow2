package com.legalflow.appointment.scheduler;

import com.legalflow.appointment.domain.Appointment;
import com.legalflow.appointment.domain.AppointmentStatus;
import com.legalflow.appointment.messaging.AppointmentEventPublisher;
import com.legalflow.appointment.repository.AppointmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Envoie un rappel unique pour chaque rendez-vous planifié dans les 24 prochaines heures. La date d'envoi est
 * enregistrée ({@code reminderSentAt}) : un rendez-vous n'est jamais rappelé deux fois, sauf s'il est déplacé.
 */
@Component
public class AppointmentReminderScheduler {

    static final long REMINDER_WINDOW_HOURS = 24;

    private final AppointmentRepository appointmentRepository;
    private AppointmentEventPublisher eventPublisher;

    public AppointmentReminderScheduler(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Autowired(required = false)
    public void setEventPublisher(AppointmentEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    @Scheduled(fixedDelayString = "${legalflow.appointments.reminder-interval-ms:900000}")
    @Transactional
    public void sendDueReminders() {
        sendDueReminders(LocalDateTime.now());
    }

    /** Séparée pour pouvoir être testée avec une horloge fixe. */
    @Transactional
    public int sendDueReminders(LocalDateTime now) {
        List<Appointment> due = appointmentRepository.findAllByStatusAndReminderSentAtIsNullAndDateTimeBetween(
                AppointmentStatus.SCHEDULED, now, now.plusHours(REMINDER_WINDOW_HOURS));
        for (Appointment appointment : due) {
            if (eventPublisher != null) {
                eventPublisher.reminder(appointment);
            }
            appointment.markReminderSent(now);
            appointmentRepository.save(appointment);
        }
        return due.size();
    }
}
