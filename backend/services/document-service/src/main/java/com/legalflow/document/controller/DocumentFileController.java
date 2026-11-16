package com.legalflow.document.controller;

import com.legalflow.document.domain.Document;
import com.legalflow.document.domain.DocumentVisibility;
import com.legalflow.document.dto.DocumentRequest;
import com.legalflow.document.security.TenantContext;
import com.legalflow.document.service.DocumentService;
import com.legalflow.document.service.FileStorageService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Envoi et téléchargement du contenu des documents. Les droits de lecture sont ceux de DocumentService. */
@RestController
@RequestMapping("/documents")
public class DocumentFileController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "txt", "rtf", "csv",
            "jpg", "jpeg", "png", "gif", "webp");
    private static final int MAX_FILE_NAME_LENGTH = 255;
    private static final int MAX_DESCRIPTION_LENGTH = 2000;
    private static final String DEFAULT_TYPE = "application/octet-stream";

    private final DocumentService documentService;
    private final FileStorageService fileStorageService;

    public DocumentFileController(DocumentService documentService, FileStorageService fileStorageService) {
        this.documentService = documentService;
        this.fileStorageService = fileStorageService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER')")
    public Document upload(@RequestParam("file") MultipartFile file,
                           @RequestParam("caseId") UUID caseId,
                           @RequestParam(value = "description", required = false) String description,
                           @RequestParam("visibility") DocumentVisibility visibility) {
        String fileName = cleanFileName(file.getOriginalFilename());
        requireAllowedExtension(fileName);
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le fichier est vide.");
        }
        String cleanDescription = description == null || description.isBlank() ? null : description.trim();
        if (cleanDescription != null && cleanDescription.length() > MAX_DESCRIPTION_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La description est trop longue (" + MAX_DESCRIPTION_LENGTH + " caractères maximum).");
        }

        UUID lawFirmId = TenantContext.requireLawFirmId();
        String storageKey = fileStorageService.newKey(lawFirmId, caseId);
        long storedSize;
        try (InputStream content = file.getInputStream()) {
            storedSize = fileStorageService.store(storageKey, content);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Le fichier n'a pas pu être enregistré.");
        }

        try {
            DocumentRequest request = new DocumentRequest();
            request.setCaseId(caseId);
            request.setFileName(fileName);
            request.setFileType(declaredType(file.getContentType()));
            request.setFileSize(storedSize);
            request.setStorageKey(storageKey);
            request.setDescription(cleanDescription);
            request.setVisibility(visibility);
            // Vérifie aussi que le dossier appartient bien au cabinet de l'appelant.
            return documentService.createDocument(request);
        } catch (RuntimeException exception) {
            fileStorageService.deleteQuietly(storageKey);
            throw exception;
        }
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('ADMIN','SECRETARY','LAWYER','CLIENT')")
    public ResponseEntity<Resource> download(@PathVariable UUID id) {
        // getDocument applique le cabinet, le dossier et la visibilité : un client ne reçoit que CASE_MEMBERS.
        Document document = documentService.getDocument(id);
        String storageKey = document.getStorageKey();
        boolean ownKey = storageKey != null
                && storageKey.startsWith(FileStorageService.keyPrefix(document.getLawFirmId(), document.getCaseId()));
        if (!ownKey || !fileStorageService.exists(storageKey)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier non disponible pour ce document.");
        }

        Resource resource = new FileSystemResource(fileStorageService.resolve(storageKey));
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(document.getFileName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(resource);
    }

    private static String cleanFileName(String originalName) {
        if (originalName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du fichier est obligatoire.");
        }
        String name = originalName.substring(Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\')) + 1);
        name = name.replaceAll("\\p{Cntrl}", "").trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du fichier est obligatoire.");
        }
        if (name.length() > MAX_FILE_NAME_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le nom du fichier est trop long (" + MAX_FILE_NAME_LENGTH + " caractères maximum).");
        }
        return name;
    }

    private static void requireAllowedExtension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Type de fichier non accepté (PDF, Word, Excel, PowerPoint, texte ou image).");
        }
    }

    private static String declaredType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return DEFAULT_TYPE;
        }
        return contentType.length() > 255 ? DEFAULT_TYPE : contentType;
    }
}
