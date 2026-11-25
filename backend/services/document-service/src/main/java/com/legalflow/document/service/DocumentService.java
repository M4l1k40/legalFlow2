package com.legalflow.document.service;

import com.legalflow.document.domain.Document;
import com.legalflow.document.domain.DocumentVisibility;
import com.legalflow.document.dto.DocumentRequest;
import com.legalflow.document.dto.DocumentStatsResponse;
import com.legalflow.document.integration.CaseServiceOwnershipVerifier;
import com.legalflow.document.repository.DocumentRepository;
import com.legalflow.document.storage.FileStorage;
import com.legalflow.document.storage.StorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import com.legalflow.document.security.TenantContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final long MAX_UPLOAD_BYTES = 25L * 1024 * 1024;

    private final DocumentRepository documentRepository;
    private final CaseServiceOwnershipVerifier caseServiceOwnershipVerifier;

    public DocumentService(DocumentRepository documentRepository,
                           CaseServiceOwnershipVerifier caseServiceOwnershipVerifier) {
        this.documentRepository = documentRepository;
        this.caseServiceOwnershipVerifier = caseServiceOwnershipVerifier;
    }

    private FileStorage fileStorage;

    /** Injecté seulement quand un stockage est configuré (absent des tests de contrôleur qui n'en ont pas besoin). */
    @Autowired(required = false)
    public void setFileStorage(FileStorage fileStorage) {
        this.fileStorage = fileStorage;
    }

    /** Fichier prêt à être servi : métadonnées + flux ouvert (à fermer par l'appelant). */
    public record DownloadedFile(Document document, InputStream content) {
    }

    private FileStorage requireStorage() {
        if (fileStorage == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is not configured.");
        }
        return fileStorage;
    }

    /**
     * Téléverse un fichier : la clé de stockage est générée ici, jamais fournie par l'appelant (SEC-11), et préfixée
     * par le cabinet ; le téléchargement refuse toute clé qui ne porte pas ce préfixe.
     */
    @Transactional
    public Document uploadDocument(MultipartFile file, UUID caseId, DocumentVisibility visibility, String description) {
        UUID lawFirmId = TenantContext.requireLawFirmId();
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A non-empty file is required.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds 25 MB.");
        }
        caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(caseId);

        String originalName = sanitizeFileName(file.getOriginalFilename());
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
                ? "application/octet-stream" : file.getContentType();
        String storageKey = lawFirmId + "/" + caseId + "/" + UUID.randomUUID();

        try (InputStream in = file.getInputStream()) {
            requireStorage().put(storageKey, in, file.getSize(), contentType);
        } catch (IOException | StorageException exception) {
            log.error("Upload failed for case {}", caseId, exception);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is unavailable.");
        }

        Document document = new Document(lawFirmId, caseId, TenantContext.currentUserIdOrNull(), originalName,
                contentType, file.getSize(), storageKey, description, visibility);
        try {
            return documentRepository.save(document);
        } catch (RuntimeException exception) {
            deleteQuietly(storageKey);
            throw exception;
        }
    }

    /** Télécharge un document : mêmes règles d'accès que la lecture, plus vérification du préfixe de cabinet de la clé. */
    @Transactional(readOnly = true)
    public DownloadedFile downloadDocument(UUID id) {
        Document document = getDocument(id);
        String prefix = TenantContext.requireLawFirmId() + "/";
        if (document.getStorageKey() == null || !document.getStorageKey().startsWith(prefix)) {
            // Métadonnées créées avant l'intégration MinIO (clé fournie par l'appelant) : aucun fichier servi.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No file is stored for document: " + id);
        }
        try {
            return new DownloadedFile(document, requireStorage().get(document.getStorageKey()));
        } catch (StorageException exception) {
            log.error("Download failed for document {}", id, exception);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File storage is unavailable.");
        }
    }

    static String sanitizeFileName(String raw) {
        String name = raw == null ? "" : raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"<>|:*?]", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            return "document";
        }
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    private void deleteQuietly(String storageKey) {
        try {
            if (fileStorage != null) {
                fileStorage.delete(storageKey);
            }
        } catch (RuntimeException exception) {
            log.warn("Could not clean up object {}", storageKey, exception);
        }
    }

    @Transactional
    public Document createDocument(DocumentRequest request) {
        UUID lawFirmId = TenantContext.requireLawFirmId();
        caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(request.getCaseId());
        Document document = new Document(lawFirmId, request.getCaseId(), TenantContext.currentUserIdOrNull(),
                request.getFileName(), request.getFileType(), request.getFileSize(), request.getStorageKey(),
                request.getDescription(), request.getVisibility());
        return documentRepository.save(document);
    }

    @Transactional(readOnly = true)
    public List<Document> getDocumentsByCase(UUID caseId) {
        UUID lawFirmId = TenantContext.requireLawFirmId();
        caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(caseId);
        return documentRepository.findAllByLawFirmIdAndCaseIdOrderByCreatedAtDesc(lawFirmId, caseId).stream()
                .filter(this::isVisibleByRole)
                .toList();
    }

    @Transactional(readOnly = true)
    public Document getDocument(UUID id) {
        UUID lawFirmId = TenantContext.requireLawFirmId();
        Document document = documentRepository.findByIdAndLawFirmId(id, lawFirmId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Document not found: " + id));
        if (!TenantContext.isOfficeStaff()) {
            // Un avocat ou un client n'accède qu'aux documents d'un dossier qu'il peut voir (le case-service décide).
            try {
                caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(document.getCaseId());
            } catch (ResponseStatusException exception) {
                if (exception.getStatusCode().value() == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found: " + id);
                }
                throw exception;
            }
        }
        if (!isVisibleByRole(document)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found: " + id);
        }
        return document;
    }

    /**
     * Visibilité d'un document (le dossier a déjà été vérifié) :
     * CASE_MEMBERS : personnel du cabinet et client du dossier ;
     * LAWYER_ONLY : ADMIN et LAWYER ; PRIVATE : son auteur et ADMIN. Le CLIENT ne voit que CASE_MEMBERS.
     */
    private boolean isVisibleByRole(Document document) {
        DocumentVisibility visibility = document.getVisibility();
        if (!TenantContext.isStaff()) {
            return visibility == DocumentVisibility.CASE_MEMBERS;
        }
        if (visibility == DocumentVisibility.LAWYER_ONLY) {
            return TenantContext.hasRole("ADMIN") || TenantContext.isLawyer();
        }
        if (visibility == DocumentVisibility.PRIVATE) {
            UUID currentUserId = TenantContext.currentUserIdOrNull();
            boolean uploader = document.getUploadedBy() != null && document.getUploadedBy().equals(currentUserId);
            return uploader || TenantContext.hasRole("ADMIN");
        }
        return true;
    }

    /**
     * Comptage pour les tableaux de bord. Seuls les documents que l'appelant a le droit de voir sont comptés
     * (mêmes règles de visibilité que la lecture) : un total ne doit pas révéler l'existence de documents
     * réservés. Les bornes sont des instants fournis par le navigateur (minuit local, il y a 7 jours).
     */
    @Transactional(readOnly = true)
    public DocumentStatsResponse getStats(Instant weekStart, Instant todayStart) {
        UUID lawFirmId = TenantContext.requireLawFirmId();
        List<Document> visible = documentRepository.findAllByLawFirmIdOrderByCreatedAtDesc(lawFirmId).stream()
                .filter(this::isVisibleByRole)
                .toList();
        // createdAt est un LocalDateTime enregistré dans le fuseau de la JVM : on convertit les bornes dans le même fuseau.
        ZoneId zone = ZoneId.systemDefault();
        LocalDateTime week = LocalDateTime.ofInstant(weekStart, zone);
        LocalDateTime today = LocalDateTime.ofInstant(todayStart, zone);
        return new DocumentStatsResponse(visible.size(), createdSince(visible, week), createdSince(visible, today));
    }

    private static long createdSince(List<Document> documents, LocalDateTime since) {
        return documents.stream()
                .filter(document -> document.getCreatedAt() != null && !document.getCreatedAt().isBefore(since))
                .count();
    }

    @Transactional
    public Document updateDocument(UUID id, DocumentRequest request) {
        Document document = getDocument(id);
        caseServiceOwnershipVerifier.verifyCaseBelongsToCurrentTenant(request.getCaseId());
        document.setCaseId(request.getCaseId());
        document.setFileName(request.getFileName());
        document.setFileType(request.getFileType());
        document.setFileSize(request.getFileSize());
        document.setStorageKey(request.getStorageKey());
        document.setDescription(request.getDescription());
        document.setVisibility(request.getVisibility());
        return documentRepository.save(document);
    }

    @Transactional
    public void deleteDocument(UUID id) {
        Document document = getDocument(id);
        documentRepository.delete(document);
        String key = document.getStorageKey();
        if (key != null && key.startsWith(TenantContext.requireLawFirmId() + "/")) {
            deleteQuietly(key);
        }
    }
}
