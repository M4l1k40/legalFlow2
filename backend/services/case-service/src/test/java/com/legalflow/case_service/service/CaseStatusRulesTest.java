package com.legalflow.case_service.service;

import com.legalflow.case_service.domain.CaseStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CaseStatusRulesTest {

    @Test
    void movingToTheSameStatusOrWithoutStatusIsRefused() {
        assertFalse(CaseStatusRules.isAllowed(CaseStatus.OPEN, CaseStatus.OPEN));
        assertFalse(CaseStatusRules.isAllowed(null, CaseStatus.OPEN));
        assertFalse(CaseStatusRules.isAllowed(CaseStatus.OPEN, null));
    }

    @Test
    void ordinaryChangesAreAllowed() {
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.OPEN, CaseStatus.IN_PROGRESS));
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.IN_PROGRESS, CaseStatus.WAITING_CLIENT));
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.WAITING_CLIENT, CaseStatus.COURT_PROCEEDING));
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.IN_PROGRESS, CaseStatus.CLOSED));
    }

    @Test
    void aClosedCaseCanBeReopenedOrArchived() {
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.CLOSED, CaseStatus.IN_PROGRESS));
        assertTrue(CaseStatusRules.isAllowed(CaseStatus.CLOSED, CaseStatus.ARCHIVED));
    }

    @Test
    void onlyAClosedCaseCanBeArchived() {
        assertFalse(CaseStatusRules.isAllowed(CaseStatus.OPEN, CaseStatus.ARCHIVED));
        assertFalse(CaseStatusRules.isAllowed(CaseStatus.COURT_PROCEEDING, CaseStatus.ARCHIVED));
    }

    @Test
    void anArchivedCaseNeverChanges() {
        for (CaseStatus target : CaseStatus.values()) {
            assertFalse(CaseStatusRules.isAllowed(CaseStatus.ARCHIVED, target));
        }
    }
}
