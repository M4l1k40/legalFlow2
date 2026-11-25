package com.legalflow.judicial_service.service;

import com.legalflow.judicial_service.domain.Court;
import com.legalflow.judicial_service.domain.Judge;
import com.legalflow.judicial_service.domain.JudgeRequest;
import com.legalflow.judicial_service.integration.CaseServiceOwnershipVerifier;
import com.legalflow.judicial_service.repository.CourtRepository;
import com.legalflow.judicial_service.repository.HearingRepository;
import com.legalflow.judicial_service.repository.JudgeRepository;
import com.legalflow.judicial_service.repository.JudicialCaseRepository;
import com.legalflow.judicial_service.repository.JudicialEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** SEC-10 : tribunaux et juges propres à chaque cabinet ; les données partagées (law_firm_id NULL) sont en lecture seule. */
class JudicialCourtScopingTest {

    private static final UUID FIRM_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FIRM_B = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID USER = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private CourtRepository courtRepository;
    private JudgeRepository judgeRepository;
    private JudicialService service;

    @BeforeEach
    void setUp() {
        courtRepository = mock(CourtRepository.class);
        judgeRepository = mock(JudgeRepository.class);
        service = new JudicialService(courtRepository, judgeRepository, mock(JudicialCaseRepository.class),
                mock(HearingRepository.class), mock(JudicialEventRepository.class), mock(CaseServiceOwnershipVerifier.class));
        when(courtRepository.save(any(Court.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(judgeRepository.save(any(Judge.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject(USER.toString())
                .claim("lawFirmId", FIRM_A.toString()).build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_LAWYER"))));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private static Court court(UUID id, UUID firm) {
        Court court = new Court("Tribunal", "CIVIL", "Rabat", null);
        ReflectionTestUtils.setField(court, "id", id);
        court.setLawFirmId(firm);
        return court;
    }

    @Test
    void createdCourtBelongsToTheCallersFirmWhateverTheBodySays() {
        Court body = new Court("Tribunal", "CIVIL", "Rabat", null);
        body.setLawFirmId(FIRM_B);

        assertEquals(FIRM_A, service.createCourt(body).getLawFirmId());
    }

    @Test
    void listShowsOwnAndSharedCourtsButNotAnotherFirms() {
        Court own = court(UUID.randomUUID(), FIRM_A);
        Court shared = court(UUID.randomUUID(), null);
        Court foreign = court(UUID.randomUUID(), FIRM_B);
        when(courtRepository.findAll()).thenReturn(List.of(own, shared, foreign));

        List<Court> visible = service.findAllCourts();

        assertEquals(2, visible.size());
        assertTrue(visible.contains(own) && visible.contains(shared));
    }

    @Test
    void anotherFirmsCourtIsNotFound() {
        UUID id = UUID.randomUUID();
        when(courtRepository.findById(id)).thenReturn(Optional.of(court(id, FIRM_B)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.findCourtById(id));

        assertEquals(HttpStatus.NOT_FOUND.value(), error.getStatusCode().value());
    }

    @Test
    void aJudgeCanBeAddedToAnOwnCourt() {
        UUID id = UUID.randomUUID();
        when(courtRepository.findById(id)).thenReturn(Optional.of(court(id, FIRM_A)));
        JudgeRequest request = new JudgeRequest();
        request.setCourtId(id);
        request.setFirstName("Sara");
        request.setLastName("Alami");
        request.setRole("PRESIDENT");

        assertEquals("Alami", service.createJudge(request).getLastName());
    }

    @Test
    void aSharedCourtIsReadOnly() {
        UUID id = UUID.randomUUID();
        when(courtRepository.findById(id)).thenReturn(Optional.of(court(id, null)));
        JudgeRequest request = new JudgeRequest();
        request.setCourtId(id);
        request.setFirstName("Sara");
        request.setLastName("Alami");
        request.setRole("PRESIDENT");

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () -> service.createJudge(request));

        assertEquals(HttpStatus.FORBIDDEN.value(), error.getStatusCode().value());
        verify(judgeRepository, never()).save(any(Judge.class));
    }
}
