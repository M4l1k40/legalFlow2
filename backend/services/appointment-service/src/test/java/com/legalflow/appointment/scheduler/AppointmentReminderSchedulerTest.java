package com.legalflow.appointment.scheduler;

import com.legalflow.appointment.domain.Appointment;
import com.legalflow.appointment.domain.AppointmentStatus;
import com.legalflow.appointment.domain.AppointmentType;
import com.legalflow.appointment.messaging.AppointmentEventPublisher;
import com.legalflow.appointment.repository.AppointmentRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AppointmentReminderSchedulerTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 24, 10, 0);

    @Test
    void remindsEachDueAppointmentOnceAndRecordsTheDate() {
        AppointmentRepository repository = mock(AppointmentRepository.class);
        AppointmentEventPublisher publisher = mock(AppointmentEventPublisher.class);
        Appointment due = new Appointment(UUID.randomUUID(), null, UUID.randomUUID(), UUID.randomUUID(),
                NOW.plusHours(5), AppointmentType.CONSULTATION, AppointmentStatus.SCHEDULED, null, null);
        when(repository.findAllByStatusAndReminderSentAtIsNullAndDateTimeBetween(
                eq(AppointmentStatus.SCHEDULED), eq(NOW), eq(NOW.plusHours(24)))).thenReturn(List.of(due));
        AppointmentReminderScheduler scheduler = new AppointmentReminderScheduler(repository);
        scheduler.setEventPublisher(publisher);

        assertEquals(1, scheduler.sendDueReminders(NOW));

        verify(publisher).reminder(due);
        verify(repository).save(due);
        assertEquals(NOW, due.getReminderSentAt());
    }

    @Test
    void reschedulingAnAppointmentResetsItsReminder() {
        Appointment appointment = new Appointment(UUID.randomUUID(), null, UUID.randomUUID(), UUID.randomUUID(),
                NOW.plusHours(5), AppointmentType.CONSULTATION, AppointmentStatus.SCHEDULED, null, null);
        appointment.markReminderSent(NOW);
        assertNotNull(appointment.getReminderSentAt());

        appointment.reschedule(NOW.plusDays(3), AppointmentType.CONSULTATION, "Bureau", null);

        assertEquals(null, appointment.getReminderSentAt());
    }

    @Test
    void worksWithoutAnEventPublisher() {
        AppointmentRepository repository = mock(AppointmentRepository.class);
        Appointment due = new Appointment(UUID.randomUUID(), null, UUID.randomUUID(), UUID.randomUUID(),
                NOW.plusHours(1), AppointmentType.CONSULTATION, AppointmentStatus.SCHEDULED, null, null);
        when(repository.findAllByStatusAndReminderSentAtIsNullAndDateTimeBetween(any(), any(), any())).thenReturn(List.of(due));

        assertEquals(1, new AppointmentReminderScheduler(repository).sendDueReminders(NOW));
        assertEquals(NOW, due.getReminderSentAt());
    }
}
