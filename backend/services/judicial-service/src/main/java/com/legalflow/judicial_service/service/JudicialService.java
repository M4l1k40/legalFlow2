package com.legalflow.judicial_service.service;

import com.legalflow.judicial_service.domain.Court;
import com.legalflow.judicial_service.domain.Hearing;
import com.legalflow.judicial_service.domain.HearingRequest;
import com.legalflow.judicial_service.domain.HearingStatus;
import com.legalflow.judicial_service.domain.Judge;
import com.legalflow.judicial_service.domain.JudicialCase;
import com.legalflow.judicial_service.domain.JudicialCaseStatus;
import com.legalflow.judicial_service.domain.JudicialEvent;
import com.legalflow.judicial_service.domain.JudgeRequest;
import com.legalflow.judicial_service.integration.CaseServiceOwnershipVerifier;
import com.legalflow.judicial_service.messaging.JudicialEventPublisher;
import com.legalflow.judicial_service.repository.CourtRepository;
import org.springframework.beans.factory.annotation.Autowired;
import com.legalflow.judicial_service.repository.HearingRepository;
import com.legalflow.judicial_service.repository.JudgeRepository;
import com.legalflow.judicial_service.repository.JudicialCaseRepository;
import com.legalflow.judicial_service.repository.JudicialEventRepository;
import com.legalflow.judicial_service.security.TenantContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class JudicialService {

    private static final Map<JudicialCaseStatus, Set<JudicialCaseStatus>> JUDICIAL_CASE_TRANSITIONS = Map.of(
        JudicialCaseStatus.REGISTERED, Set.of(JudicialCaseStatus.IN_PROGRESS, JudicialCaseStatus.HEARING_SCHEDULED),
        JudicialCaseStatus.IN_PROGRESS, Set.of(JudicialCaseStatus.HEARING_SCHEDULED, JudicialCaseStatus.DELIBERATION, JudicialCaseStatus.CLOSED),
        JudicialCaseStatus.HEARING_SCHEDULED, Set.of(JudicialCaseStatus.DELIBERATION, JudicialCaseStatus.CLOSED),
        JudicialCaseStatus.DELIBERATION, Set.of(JudicialCaseStatus.JUDGMENT_ISSUED, JudicialCaseStatus.CLOSED),
        JudicialCaseStatus.JUDGMENT_ISSUED, Set.of(JudicialCaseStatus.CLOSED),
        JudicialCaseStatus.CLOSED, Set.of());

    private static final Map<HearingStatus, Set<HearingStatus>> HEARING_TRANSITIONS = Map.of(
        HearingStatus.SCHEDULED, Set.of(HearingStatus.COMPLETED, HearingStatus.POSTPONED, HearingStatus.CANCELLED),
        HearingStatus.COMPLETED, Set.of(),
        HearingStatus.POSTPONED, Set.of(HearingStatus.SCHEDULED, HearingStatus.CANCELLED),
        HearingStatus.CANCELLED, Set.of());

    private final CourtRepository courtRepository;
    private final JudgeRepository judgeRepository;
    private final JudicialCaseRepository judicialCaseRepository;
    private final HearingRepository hearingRepository;
    private final JudicialEventRepository judicialEventRepository;
    private final CaseServiceOwnershipVerifier caseServiceOwnershipVerifier;
    private JudicialEventPublisher eventPublisher;

    /** Optionnel : absent des tests qui construisent le service à la main ; les événements sont alors ignorés. */
    @Autowired(required = false)
    public void setEventPublisher(JudicialEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    public JudicialService(CourtRepository courtRepository,
                          JudgeRepository judgeRepository,
                          JudicialCaseRepository judicialCaseRepository,
                          HearingRepository hearingRepository,
                          JudicialEventRepository judicialEventRepository,
                          CaseServiceOwnershipVerifier caseServiceOwnershipVerifier) {
        this.courtRepository = courtRepository;
        this.judgeRepository = judgeRepository;
        this.judicialCaseRepository = judicialCaseRepository;
        this.hearingRepository = hearingRepository;
        this.judicialEventRepository = judicialEventRepository;
        this.caseServiceOwnershipVerifier = caseServiceOwnershipVerifier;
    }

    @Transactional(readOnly = true)
    public List<Court> findAllCourts() {
        UUID tenantId = TenantContext.requireLawFirmId();
        return courtRepository.findAll().stream().filter(court -> isCourtVisible(court, tenantId)).toList();
    }

    @Transactional(readOnly = true)
    public Court findCourtById(UUID id) {
        UUID tenantId = TenantContext.requireLawFirmId();
        return courtRepository.findById(id)
                .filter(court -> isCourtVisible(court, tenantId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Court not found: " + id));
    }

    /** SEC-10 : un tribunal est visible s'il appartient au cabinet ou s'il est une donnée de référence partagée. */
    private static boolean isCourtVisible(Court court, UUID tenantId) {
        return court.getLawFirmId() == null || tenantId.equals(court.getLawFirmId());
    }

    /** SEC-10 : seul le cabinet propriétaire modifie un tribunal ; les données partagées sont en lecture seule. */
    private Court findOwnedCourt(UUID id) {
        Court court = findCourtById(id);
        if (!TenantContext.requireLawFirmId().equals(court.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This court is shared reference data and is read-only. Create your own court instead.");
        }
        return court;
    }

    @Transactional
    public Court createCourt(Court court) {
        court.setLawFirmId(TenantContext.requireLawFirmId());
        return courtRepository.save(court);
    }

    @Transactional(readOnly = true)
    public List<Judge> findJudgesByCourtId(UUID courtId) {
        findCourtById(courtId);
        return judgeRepository.findByCourtIdOrderByLastNameAscFirstNameAsc(courtId);
    }

    @Transactional
    public Judge createJudge(UUID courtId, Judge judge) {
        Court court = findOwnedCourt(courtId);
        judge.setCourt(court);
        return judgeRepository.save(judge);
    }

    @Transactional
    public Judge createJudge(JudgeRequest request) {
        Court court = findOwnedCourt(request.getCourtId());
        Judge judge = new Judge(court, request.getFirstName(), request.getLastName(), request.getRole());
        return judgeRepository.save(judge);
    }

    @Transactional(readOnly = true)
    public List<JudicialCase> findJudicialCasesByLawFirmId(UUID requestedLawFirmId) {
        UUID tenantId = TenantContext.requireLawFirmId();
        if (requestedLawFirmId != null && !tenantId.equals(requestedLawFirmId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "lawFirmId query parameter does not match your tenant.");
        }
        List<JudicialCase> judicialCases = judicialCaseRepository.findAllByLawFirmIdOrderByOpeningDateDesc(tenantId);
        if (TenantContext.isOfficeStaff()) {
            return judicialCases;
        }
        return judicialCases.stream().filter(this::visibleToCurrentUser).toList();
    }

    @Transactional(readOnly = true)
    public JudicialCase findJudicialCaseById(UUID id) {
        UUID tenantId = TenantContext.requireLawFirmId();
        JudicialCase judicialCase = judicialCaseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + id));
        if (!tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + id);
        }
        requireVisible(judicialCase, id);
        return judicialCase;
    }

    @Transactional
    public JudicialCase createJudicialCase(JudicialCase judicialCase) {
        UUID tenantId = TenantContext.requireLawFirmId();
        if (judicialCase.getLawFirmId() != null && !tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "lawFirmId in request body does not match your tenant.");
        }

        validateJudicialCaseReferences(judicialCase.getCourtId(), judicialCase.getJudgeId());
        caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(judicialCase.getCaseId());
        judicialCase.setLawFirmId(tenantId);
        if (judicialCase.getStatus() == null) {
            judicialCase.setStatus(JudicialCaseStatus.REGISTERED);
        }

        JudicialCase saved = judicialCaseRepository.save(judicialCase);
        JudicialEvent event = new JudicialEvent("JUDICIAL_CASE_REGISTERED",
                "Judicial case registered for caseId=" + saved.getCaseId(), LocalDateTime.now(), "system");
        saved.addEvent(event);
        judicialCaseRepository.save(saved);
        if (eventPublisher != null) {
            eventPublisher.caseRegistered(saved);
        }
        return saved;
    }

    private void validateJudicialCaseReferences(UUID courtId, UUID judgeId) {
        UUID tenantId = TenantContext.requireLawFirmId();
        Court court = courtRepository.findById(courtId)
                .filter(candidate -> isCourtVisible(candidate, tenantId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Court not found: " + courtId));

        Judge judge = judgeRepository.findById(judgeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Judge not found: " + judgeId));

        if (!court.getId().equals(judge.getCourt() == null ? null : judge.getCourt().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Judge does not belong to the selected court.");
        }
    }

    @Transactional
    public JudicialCase updateJudicialCaseStatus(UUID id, JudicialCaseStatus newStatus) {
        UUID tenantId = TenantContext.requireLawFirmId();
        JudicialCase judicialCase = judicialCaseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + id));
        if (!tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + id);
        }
        // Un avocat ne modifie que les procédures des dossiers qu'il peut voir (comme pour la lecture).
        requireVisible(judicialCase, id);

        JudicialCaseStatus current = judicialCase.getStatus();
        if (current == null) {
            throw new IllegalArgumentException("Current judicial case status is missing");
        }

        if (!isValidStatusTransition(current, newStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Judicial case status transition from " + current + " to " + newStatus + " is not allowed");
        }

        judicialCase.setStatus(newStatus);
        JudicialEvent event = new JudicialEvent("JUDICIAL_STATUS_CHANGED",
                "Judicial case status changed from " + current + " to " + newStatus,
                LocalDateTime.now(), "system");
        judicialCase.addEvent(event);
        JudicialCase savedCase = judicialCaseRepository.save(judicialCase);
        if (eventPublisher != null) {
            eventPublisher.caseStatusChanged(savedCase);
        }
        return savedCase;
    }

    @Transactional(readOnly = true)
    public List<Hearing> findHearingsByJudicialCaseId(UUID judicialCaseId) {
        UUID tenantId = TenantContext.requireLawFirmId();
        JudicialCase judicialCase = judicialCaseRepository.findById(judicialCaseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId));
        if (!tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId);
        }
        requireVisible(judicialCase, judicialCaseId);
        return hearingRepository.findAllByJudicialCase_IdOrderByDateTimeAsc(judicialCaseId);
    }

    @Transactional(readOnly = true)
    public List<JudicialEvent> findEventsByJudicialCaseId(UUID judicialCaseId) {
        UUID tenantId = TenantContext.requireLawFirmId();
        JudicialCase judicialCase = judicialCaseRepository.findById(judicialCaseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId));
        if (!tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId);
        }
        requireVisible(judicialCase, judicialCaseId);
        return judicialEventRepository.findAllByJudicialCase_IdOrderByEventDateAsc(judicialCaseId);
    }

    @Transactional
    public Hearing createHearing(UUID judicialCaseId, HearingRequest request) {
        UUID tenantId = TenantContext.requireLawFirmId();
        JudicialCase judicialCase = judicialCaseRepository.findById(judicialCaseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId));
        if (!tenantId.equals(judicialCase.getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + judicialCaseId);
        }
        requireVisible(judicialCase, judicialCaseId);
        if (judicialCase.getStatus() == JudicialCaseStatus.CLOSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A hearing cannot be scheduled on a closed judicial case.");
        }
        Hearing hearing = new Hearing(judicialCase, request.getDateTime(), request.getType(), request.getStatus(),
                request.getLocation(), request.getNotes(), request.getNextAction());
        hearing.setJudicialCase(judicialCase);

        if (hearing.getStatus() == null) {
            hearing.setStatus(HearingStatus.SCHEDULED);
        }

        Hearing saved = hearingRepository.save(hearing);
        // Le statut n'avance que si la transition est autorisée : une procédure en délibéré ne « recule » pas.
        if (isValidStatusTransition(judicialCase.getStatus(), JudicialCaseStatus.HEARING_SCHEDULED)) {
            judicialCase.setStatus(JudicialCaseStatus.HEARING_SCHEDULED);
        }

        JudicialEvent event = new JudicialEvent("HEARING_CREATED",
                "Hearing scheduled for " + saved.getDateTime() + " type=" + saved.getType(),
                LocalDateTime.now(), "system");
        judicialCase.addEvent(event);
        judicialCaseRepository.save(judicialCase);
        if (eventPublisher != null) {
            eventPublisher.hearingCreated(judicialCase);
        }
        return saved;
    }

    @Transactional
    public Hearing updateHearingStatus(UUID hearingId, HearingStatus newStatus) {
        UUID tenantId = TenantContext.requireLawFirmId();
        Hearing hearing = hearingRepository.findById(hearingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hearing not found: " + hearingId));
        if (!tenantId.equals(hearing.getJudicialCase().getLawFirmId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Hearing not found: " + hearingId);
        }
        requireVisible(hearing.getJudicialCase(), hearing.getJudicialCase().getId());

        HearingStatus current = hearing.getStatus();
        if (!isValidHearingStatusTransition(current, newStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Hearing status transition from " + current + " to " + newStatus + " is not allowed");
        }

        hearing.setStatus(newStatus);
        Hearing saved = hearingRepository.save(hearing);

        JudicialEvent event = new JudicialEvent("HEARING_STATUS_CHANGED",
                "Hearing status changed from " + current + " to " + newStatus,
                LocalDateTime.now(), "system");
        hearing.getJudicialCase().addEvent(event);
        judicialCaseRepository.save(hearing.getJudicialCase());

        // Terminer une audience met la procédure en délibéré seulement si cette transition est autorisée :
        // une procédure déjà jugée ou close ne doit pas être rouverte par un simple changement d'audience.
        if (newStatus == HearingStatus.COMPLETED
                && isValidStatusTransition(hearing.getJudicialCase().getStatus(), JudicialCaseStatus.DELIBERATION)) {
            hearing.getJudicialCase().setStatus(JudicialCaseStatus.DELIBERATION);
            judicialCaseRepository.save(hearing.getJudicialCase());
        }

        if (eventPublisher != null) {
            eventPublisher.hearingStatusChanged(hearing.getJudicialCase());
        }
        return saved;
    }

    private boolean isValidStatusTransition(JudicialCaseStatus current, JudicialCaseStatus next) {
        return current != null && next != null
                && JUDICIAL_CASE_TRANSITIONS.getOrDefault(current, Set.of()).contains(next);
    }

    private boolean isValidHearingStatusTransition(HearingStatus current, HearingStatus next) {
        return current != null && next != null
                && HEARING_TRANSITIONS.getOrDefault(current, Set.of()).contains(next);
    }

    /** Un avocat ou un client ne voit une affaire judiciaire que si le dossier correspondant lui est accessible (le case-service décide). */
    private boolean visibleToCurrentUser(JudicialCase judicialCase) {
        if (TenantContext.isOfficeStaff()) {
            return true;
        }
        try {
            caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(judicialCase.getCaseId());
            return true;
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode().value() == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
                return false;
            }
            throw exception;
        }
    }

    private void requireVisible(JudicialCase judicialCase, UUID id) {
        if (!visibleToCurrentUser(judicialCase)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Judicial case not found: " + id);
        }
    }
}
