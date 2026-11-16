package com.legalflow.client.controller;

import com.legalflow.client.domain.Client;
import com.legalflow.client.dto.ClientLawyersRequest;
import com.legalflow.client.dto.ClientProfileRequest;
import com.legalflow.client.integration.UserAccountNameSynchronizer;
import com.legalflow.client.service.ClientService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/clients")
public class ClientController {

    private final ClientService clientService;
    private final UserAccountNameSynchronizer nameSynchronizer;

    public ClientController(ClientService clientService, UserAccountNameSynchronizer nameSynchronizer) {
        this.clientService = clientService;
        this.nameSynchronizer = nameSynchronizer;
    }

    /** Liste des clients du cabinet : réservée au personnel. */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','LAWYER','SECRETARY')")
    public List<Client> findAll(@RequestParam(required = false) UUID lawFirmId) {
        return clientService.findAllByLawFirmId(lawFirmId);
    }

    /** Fiche de l'utilisateur CLIENT connecté. */
    @GetMapping("/me")
    @PreAuthorize("hasRole('CLIENT')")
    public Client me() {
        return clientService.findCurrentClient();
    }

    /** Le client connecté modifie sa propre fiche (nom, téléphone, adresse). */
    @PutMapping("/me")
    @PreAuthorize("hasRole('CLIENT')")
    public Client updateMe(@Valid @RequestBody ClientProfileRequest request) {
        Client updated = clientService.updateCurrentClient(request);
        // Après l'enregistrement (hors transaction) : recopie le nom vers Keycloak, sans bloquer en cas d'échec.
        nameSynchronizer.syncName(updated.getFirstName(), updated.getLastName());
        return updated;
    }

    /** Personnel : n'importe quelle fiche du cabinet. Client : uniquement sa propre fiche. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','LAWYER','SECRETARY','CLIENT')")
    public Client findById(@PathVariable UUID id) {
        return clientService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','LAWYER','SECRETARY')")
    public Client create(@Valid @RequestBody Client client) {
        return clientService.save(client);
    }

    /** Désigne les avocats en charge du client (administrateur ou secrétaire). */
    @PutMapping("/{id}/lawyers")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY')")
    public Client updateLawyers(@PathVariable UUID id, @Valid @RequestBody ClientLawyersRequest request) {
        return clientService.updateLawyers(id, request.lawyerIds());
    }
}
