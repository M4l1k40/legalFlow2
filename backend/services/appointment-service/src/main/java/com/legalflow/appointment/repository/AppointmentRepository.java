package com.legalflow.appointment.repository;

import com.legalflow.appointment.domain.Appointment;
import com.legalflow.appointment.domain.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    List<Appointment> findAllByLawFirmIdOrderByDateTimeAsc(UUID lawFirmId);

    List<Appointment> findAllByLawFirmIdAndCaseIdOrderByDateTimeAsc(UUID lawFirmId, UUID caseId);

    List<Appointment> findAllByLawFirmIdAndLawyerIdOrderByDateTimeAsc(UUID lawFirmId, UUID lawyerId);

    List<Appointment> findAllByLawFirmIdAndClientIdOrderByDateTimeAsc(UUID lawFirmId, UUID clientId);

    /** Rendez-vous planifiés dans la fenêtre donnée et pas encore rappelés (tous cabinets : tâche de fond). */
    List<Appointment> findAllByStatusAndReminderSentAtIsNullAndDateTimeBetween(
            AppointmentStatus status, LocalDateTime from, LocalDateTime to);
    Optional<Appointment> findByIdAndLawFirmId(UUID id, UUID lawFirmId);
}
