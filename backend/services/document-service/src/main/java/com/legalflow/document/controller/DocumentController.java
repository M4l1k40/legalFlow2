package com.legalflow.document.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import com.legalflow.document.domain.Document;
import com.legalflow.document.domain.DocumentVisibility;
import com.legalflow.document.dto.DocumentRequest;
import com.legalflow.document.dto.DocumentStatsResponse;
import com.legalflow.document.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER')")
    public Document createDocument(@Valid @RequestBody DocumentRequest request) {
        return documentService.createDocument(request);
    }

    /** Téléversement réel (multipart) : le fichier part dans MinIO, la clé de stockage est générée par le serveur. */
    @PostMapping(path = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER')")
    public Document uploadDocument(@RequestPart("file") MultipartFile file,
                                   @RequestParam UUID caseId,
                                   @RequestParam DocumentVisibility visibility,
                                   @RequestParam(required = false) String description) {
        return documentService.uploadDocument(file, caseId, visibility, description);
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER','CLIENT')")
    public ResponseEntity<InputStreamResource> download(@PathVariable UUID id) {
        DocumentService.DownloadedFile file = documentService.downloadDocument(id);
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(file.document().getFileType());
        } catch (RuntimeException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(file.document().getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.document().getFileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(new InputStreamResource(file.content()));
    }

    /** Comptage pour les tableaux de bord du personnel de bureau (le CLIENT et l'avocat n'en ont pas l'usage). */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY')")
    public DocumentStatsResponse getStats(@RequestParam Instant weekStart, @RequestParam Instant todayStart) {
        return documentService.getStats(weekStart, todayStart);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER','CLIENT')")
    public Document getDocument(@PathVariable UUID id) {
        return documentService.getDocument(id);
    }

    @GetMapping("/case/{caseId}")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER','CLIENT')")
    public List<Document> getDocumentsByCase(@PathVariable UUID caseId) {
        return documentService.getDocumentsByCase(caseId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','LAWYER')")
    public Document updateDocument(@PathVariable UUID id, @Valid @RequestBody DocumentRequest request) {
        return documentService.updateDocument(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','LAWYER')")
    public void deleteDocument(@PathVariable UUID id) {
        documentService.deleteDocument(id);
    }
}
