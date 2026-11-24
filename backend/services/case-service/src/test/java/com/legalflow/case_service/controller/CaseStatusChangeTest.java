package com.legalflow.case_service.controller;

import com.legalflow.case_service.config.CaseSecurityConfig;
import com.legalflow.case_service.domain.CaseEvent;
import com.legalflow.case_service.domain.CaseStatus;
import com.legalflow.case_service.domain.LegalCase;
import com.legalflow.case_service.integration.ClientServiceOwnershipVerifier;
import com.legalflow.case_service.messaging.CaseEventPublisher;
import com.legalflow.case_service.repository.CaseEventRepository;
import com.legalflow.case_service.repository.LegalCaseRepository;
import com.legalflow.case_service.service.CaseService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CaseController.class)
@Import({CaseService.class, CaseSecurityConfig.class, CaseExceptionHandler.class})
class CaseStatusChangeTest {

    private static final UUID FIRM_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FIRM_B = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID CASE_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CLIENT_ID = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    private static final UUID LAWYER_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_LAWYER_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final UUID ADMIN_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LegalCaseRepository legalCaseRepository;

    @MockBean
    private CaseEventRepository caseEventRepository;

    @MockBean
    private ClientServiceOwnershipVerifier clientServiceOwnershipVerifier;

    @MockBean
    private CaseEventPublisher caseEventPublisher;

    private static JwtRequestPostProcessor as(String role, UUID userId, UUID firmId) {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role))
                .jwt(token -> token.subject(userId.toString()).claim("lawFirmId", firmId.toString())
                        .claim("clientId", CLIENT_ID.toString()));
    }

    private static LegalCase caseOf(UUID lawyerId, CaseStatus status) {
        return new LegalCase(FIRM_A, CLIENT_ID, lawyerId, "CASE-1", "Mine", "Desc", status);
    }

    @Test
    void lawyerChangesTheStatusOfHisCaseAndTheChangeIsRecorded() throws Exception {
        when(legalCaseRepository.findById(CASE_ID)).thenReturn(Optional.of(caseOf(LAWYER_ID, CaseStatus.OPEN)));
        when(legalCaseRepository.save(any(LegalCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\",\"note\":\"Dossier pris en charge\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        ArgumentCaptor<CaseEvent> captor = ArgumentCaptor.forClass(CaseEvent.class);
        verify(caseEventRepository).save(captor.capture());
        assertEquals("STATUS_CHANGED", captor.getValue().getType());
        assertEquals("OPEN -> IN_PROGRESS | Dossier pris en charge", captor.getValue().getDescription());
        assertEquals(LAWYER_ID.toString(), captor.getValue().getCreatedBy());
    }

    @Test
    void lawyerCannotChangeAnotherLawyersCase() throws Exception {
        when(legalCaseRepository.findById(CASE_ID)).thenReturn(Optional.of(caseOf(OTHER_LAWYER_ID, CaseStatus.OPEN)));

        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isNotFound());

        verify(legalCaseRepository, never()).save(any(LegalCase.class));
    }

    @Test
    void otherLawFirmCannotChangeTheStatus() throws Exception {
        when(legalCaseRepository.findById(CASE_ID)).thenReturn(Optional.of(caseOf(LAWYER_ID, CaseStatus.OPEN)));

        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("ADMIN", ADMIN_ID, FIRM_B))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isNotFound());

        verify(legalCaseRepository, never()).save(any(LegalCase.class));
    }

    @Test
    void secretaryAndClientCannotChangeTheStatus() throws Exception {
        for (String role : new String[] {"SECRETARY", "CLIENT"}) {
            mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                            .with(as(role, ADMIN_ID, FIRM_A))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"IN_PROGRESS\"}"))
                    .andExpect(status().isForbidden());
        }

        verify(legalCaseRepository, never()).save(any(LegalCase.class));
    }

    @Test
    void forbiddenTransitionsReturn409() throws Exception {
        when(legalCaseRepository.findById(CASE_ID)).thenReturn(Optional.of(caseOf(LAWYER_ID, CaseStatus.OPEN)));

        // Même statut
        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"OPEN\"}"))
                .andExpect(status().isConflict());

        // On n'archive qu'un dossier clôturé
        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isConflict());

        // Un dossier archivé ne change plus
        when(legalCaseRepository.findById(CASE_ID)).thenReturn(Optional.of(caseOf(LAWYER_ID, CaseStatus.ARCHIVED)));
        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"OPEN\"}"))
                .andExpect(status().isConflict());

        verify(legalCaseRepository, never()).save(any(LegalCase.class));
    }

    @Test
    void missingOrUnknownStatusReturns400() throws Exception {
        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"sans statut\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/cases/{id}/status", CASE_ID)
                        .with(as("LAWYER", LAWYER_ID, FIRM_A))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"INVENTED\"}"))
                .andExpect(status().isBadRequest());
    }
}
