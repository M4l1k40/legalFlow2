package com.legalflow.document.service;

import com.legalflow.document.domain.Document;
import com.legalflow.document.domain.DocumentVisibility;
import com.legalflow.document.integration.CaseServiceOwnershipVerifier;
import com.legalflow.document.repository.DocumentRepository;
import com.legalflow.document.storage.FileStorage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DocumentServiceUploadTest {

    private static final UUID FIRM_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID FIRM_B = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID CASE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID USER_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    /** Stockage en mémoire : aucune dépendance à MinIO dans les tests unitaires. */
    private static final class InMemoryStorage implements FileStorage {
        final Map<String, byte[]> objects = new HashMap<>();

        @Override
        public void put(String key, InputStream content, long size, String contentType) {
            try {
                objects.put(key, content.readAllBytes());
            } catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public InputStream get(String key) {
            return new ByteArrayInputStream(objects.get(key));
        }

        @Override
        public void delete(String key) {
            objects.remove(key);
        }
    }

    private DocumentRepository repository;
    private InMemoryStorage storage;
    private DocumentService service;

    private void authenticate(UUID firm, String role) {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none")
                .claim("lawFirmId", firm.toString()).subject(USER_ID.toString()).build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @BeforeEach
    void setUp() {
        repository = mock(DocumentRepository.class);
        storage = new InMemoryStorage();
        service = new DocumentService(repository, mock(CaseServiceOwnershipVerifier.class));
        service.setFileStorage(storage);
        when(repository.save(any(Document.class))).thenAnswer(invocation -> invocation.getArgument(0));
        authenticate(FIRM_A, "LAWYER");
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void uploadStoresFileUnderServerGeneratedFirmPrefixedKey() {
        byte[] content = "contrat".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "contrat.pdf", "application/pdf", content);

        Document saved = service.uploadDocument(file, CASE_ID, DocumentVisibility.CASE_MEMBERS, "Contrat signé");

        assertTrue(saved.getStorageKey().startsWith(FIRM_A + "/" + CASE_ID + "/"));
        assertEquals("contrat.pdf", saved.getFileName());
        assertEquals((long) content.length, saved.getFileSize().longValue());
        assertArrayEquals(content, storage.objects.get(saved.getStorageKey()));
    }

    @Test
    void uploadStripsPathAndControlCharactersFromFileName() {
        MockMultipartFile file = new MockMultipartFile("file", "..\\..\\evil/../a<b>.txt", "text/plain", new byte[] {1});

        Document saved = service.uploadDocument(file, CASE_ID, DocumentVisibility.PRIVATE, null);

        assertEquals("a_b_.txt", saved.getFileName());
    }

    @Test
    void uploadRejectsEmptyFile() {
        MockMultipartFile empty = new MockMultipartFile("file", "x.txt", "text/plain", new byte[0]);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.uploadDocument(empty, CASE_ID, DocumentVisibility.PRIVATE, null));

        assertEquals(HttpStatus.BAD_REQUEST.value(), error.getStatusCode().value());
        verify(repository, never()).save(any());
    }

    @Test
    void uploadWithoutConfiguredStorageIsUnavailable() {
        DocumentService noStorage = new DocumentService(repository, mock(CaseServiceOwnershipVerifier.class));
        MockMultipartFile file = new MockMultipartFile("file", "x.txt", "text/plain", new byte[] {1});

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> noStorage.uploadDocument(file, CASE_ID, DocumentVisibility.PRIVATE, null));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE.value(), error.getStatusCode().value());
    }

    @Test
    void downloadReturnsStoredBytes() throws IOException {
        Document saved = service.uploadDocument(new MockMultipartFile("file", "a.txt", "text/plain", "hello".getBytes()),
                CASE_ID, DocumentVisibility.CASE_MEMBERS, null);
        when(repository.findByIdAndLawFirmId(any(), any())).thenReturn(Optional.of(saved));

        try (InputStream in = service.downloadDocument(UUID.randomUUID()).content()) {
            assertEquals("hello", new String(in.readAllBytes()));
        }
    }

    @Test
    void downloadRefusesStorageKeyOfAnotherFirm() {
        Document foreign = new Document(FIRM_A, CASE_ID, USER_ID, "x.txt", "text/plain", 1L,
                FIRM_B + "/" + CASE_ID + "/secret", null, DocumentVisibility.CASE_MEMBERS);
        when(repository.findByIdAndLawFirmId(any(), any())).thenReturn(Optional.of(foreign));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.downloadDocument(UUID.randomUUID()));

        assertEquals(HttpStatus.NOT_FOUND.value(), error.getStatusCode().value());
    }

    @Test
    void downloadRefusesLegacyCallerSuppliedKey() {
        Document legacy = new Document(FIRM_A, CASE_ID, USER_ID, "x.txt", "text/plain", 1L,
                "some/arbitrary/key", null, DocumentVisibility.CASE_MEMBERS);
        when(repository.findByIdAndLawFirmId(any(), any())).thenReturn(Optional.of(legacy));

        assertThrows(ResponseStatusException.class, () -> service.downloadDocument(UUID.randomUUID()));
    }

    @Test
    void deleteRemovesTheStoredObject() {
        Document saved = service.uploadDocument(new MockMultipartFile("file", "a.txt", "text/plain", "x".getBytes()),
                CASE_ID, DocumentVisibility.CASE_MEMBERS, null);
        when(repository.findByIdAndLawFirmId(any(), any())).thenReturn(Optional.of(saved));

        service.deleteDocument(UUID.randomUUID());

        assertFalse(storage.objects.containsKey(saved.getStorageKey()));
    }

    @Test
    void sanitizeFileNameFallsBackForBlankNames() {
        assertEquals("document", DocumentService.sanitizeFileName(null));
        assertEquals("document", DocumentService.sanitizeFileName(".."));
    }
}
