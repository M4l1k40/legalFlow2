package com.legalflow.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nouveau prénom et nom du compte connecté. Aucun identifiant : le compte est toujours celui du token. */
public record UpdateNameRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName) {
}
