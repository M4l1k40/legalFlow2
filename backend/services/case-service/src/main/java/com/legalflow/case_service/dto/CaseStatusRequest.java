package com.legalflow.case_service.dto;

import com.legalflow.case_service.domain.CaseStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Changement de statut : seuls le nouveau statut et une note facultative sont acceptés. */
public class CaseStatusRequest {

    @NotNull
    private CaseStatus status;

    @Size(max = 1000)
    private String note;

    public CaseStatus getStatus() {
        return status;
    }

    public void setStatus(CaseStatus status) {
        this.status = status;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }
}
