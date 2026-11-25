package com.legalflow.document.controller;

import com.legalflow.document.config.DocumentSecurityConfig;
import com.legalflow.document.domain.Document;
import com.legalflow.document.domain.DocumentVisibility;
import com.legalflow.document.dto.DocumentRequest;
import com.legalflow.document.service.DocumentService;
import com.legalflow.document.service.FileStorageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DocumentFileController.class)
@Import({DocumentSecurityConfig.class, DocumentExceptionHandler.class})
class DocumentFileControllerTest {

    private static final UUID FIRM_A = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID CASE_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID DOCUMENT_ID = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static final String KEY = FileStorageService.keyPrefix(FIRM_A, CASE_ID) + "dddddddd-dddd-dddd-dddd-dddddddddddd";

    @TempDir
    Path tempDir;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DocumentService documentService;

    @MockBean
    private FileStorageService fileStorageService;

    private static JwtRequestPostProcessor as(String role) {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role))
                .jwt(token -> token.subject(USER_ID.toString()).claim("lawFirmId", FIRM_A.toString()));
    }

    private static Document document(String storageKey) {
        return new Document(FIRM_A, CASE_ID, USER_ID, "contract.pdf", "application/pdf", 5L, storageKey,
                null, DocumentVisibility.CASE_MEMBERS);
    }

    private static MockMultipartFile file(String name) {
        return new MockMultipartFile("file", name, "application/pdf", "hello".getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void lawyerUploadsAFileAndTheDocumentRecordsItsStorageKey() throws Exception {
        when(fileStorageService.newKey(FIRM_A, CASE_ID)).thenReturn(KEY);
        when(fileStorageService.store(eq(KEY), any(InputStream.class))).thenReturn(5L);
        when(documentService.createDocument(any(DocumentRequest.class))).thenReturn(document(KEY));

        mockMvc.perform(multipart("/documents/upload").file(file("contract.pdf"))
                        .param("caseId", CASE_ID.toString())
                        .param("visibility", "CASE_MEMBERS")
                        .with(as("LAWYER")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileName").value("contract.pdf"));

        ArgumentCaptor<DocumentRequest> captor = ArgumentCaptor.forClass(DocumentRequest.class);
        verify(documentService).createDocument(captor.capture());
        assertEquals(KEY, captor.getValue().getStorageKey());
        assertEquals(5L, captor.getValue().getFileSize());
        assertEquals("contract.pdf", captor.getValue().getFileName());
    }

    @Test
    void clientCannotUpload() throws Exception {
        mockMvc.perform(multipart("/documents/upload").file(file("contract.pdf"))
                        .param("caseId", CASE_ID.toString())
                        .param("visibility", "CASE_MEMBERS")
                        .with(as("CLIENT")))
                .andExpect(status().isForbidden());

        verify(documentService, never()).createDocument(any(DocumentRequest.class));
    }

    @Test
    void executableFilesAreRejectedBeforeAnythingIsStored() throws Exception {
        mockMvc.perform(multipart("/documents/upload").file(file("virus.exe"))
                        .param("caseId", CASE_ID.toString())
                        .param("visibility", "CASE_MEMBERS")
                        .with(as("LAWYER")))
                .andExpect(status().isUnsupportedMediaType());

        verify(fileStorageService, never()).store(any(String.class), any(InputStream.class));
    }

    @Test
    void clientDownloadsASharedDocument() throws Exception {
        Path stored = tempDir.resolve("stored");
        Files.writeString(stored, "hello");
        when(documentService.getDocument(DOCUMENT_ID)).thenReturn(document(KEY));
        when(fileStorageService.exists(KEY)).thenReturn(true);
        when(fileStorageService.resolve(KEY)).thenReturn(stored);

        mockMvc.perform(get("/documents/{id}/download", DOCUMENT_ID).with(as("CLIENT")))
                .andExpect(status().isOk())
                .andExpect(header().exists("Content-Disposition"))
                .andExpect(content().bytes("hello".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void downloadIsRefusedWhenTheStorageKeyBelongsToAnotherFirmOrCase() throws Exception {
        String foreignKey = "99999999-9999-9999-9999-999999999999/" + CASE_ID + "/dddddddd-dddd-dddd-dddd-dddddddddddd";
        when(documentService.getDocument(DOCUMENT_ID)).thenReturn(document(foreignKey));
        when(fileStorageService.exists(foreignKey)).thenReturn(true);

        mockMvc.perform(get("/documents/{id}/download", DOCUMENT_ID).with(as("LAWYER")))
                .andExpect(status().isNotFound());
    }

    @Test
    void documentWithoutStoredFileReturns404() throws Exception {
        when(documentService.getDocument(DOCUMENT_ID)).thenReturn(document("documents/contract.pdf"));

        mockMvc.perform(get("/documents/{id}/download", DOCUMENT_ID).with(as("CLIENT")))
                .andExpect(status().isNotFound());
    }
}
