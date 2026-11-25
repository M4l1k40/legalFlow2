package com.legalflow.case_service.service;

import com.legalflow.case_service.domain.CaseStatus;

/**
 * Règles de changement de statut d'un dossier :
 * - on ne « change » pas vers le statut actuel ;
 * - un dossier archivé ne bouge plus ;
 * - on n'archive qu'un dossier déjà clôturé ;
 * - tout autre passage est permis (un dossier clôturé peut être rouvert).
 */
public final class CaseStatusRules {

    private CaseStatusRules() {
    }

    public static boolean isAllowed(CaseStatus from, CaseStatus to) {
        if (from == null || to == null || from == to) {
            return false;
        }
        if (from == CaseStatus.ARCHIVED) {
            return false;
        }
        if (to == CaseStatus.ARCHIVED) {
            return from == CaseStatus.CLOSED;
        }
        return true;
    }
}
