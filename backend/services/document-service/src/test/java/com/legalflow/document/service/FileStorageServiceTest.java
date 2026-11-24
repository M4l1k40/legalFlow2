package com.legalflow.document.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileStorageServiceTest {

    private static final UUID FIRM = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID CASE = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    @TempDir
    Path tempDir;

    private FileStorageService service;

    @BeforeEach
    void setUp() {
        service = new FileStorageService(tempDir.toString());
    }

    @Test
    void storesAFileUnderItsFirmAndCaseAndReadsItBack() throws Exception {
        String key = service.newKey(FIRM, CASE);

        long size = service.store(key, new ByteArrayInputStream("hello".getBytes(StandardCharsets.UTF_8)));

        assertEquals(5L, size);
        assertTrue(key.startsWith(FileStorageService.keyPrefix(FIRM, CASE)));
        assertTrue(service.exists(key));
        assertEquals("hello", Files.readString(service.resolve(key)));
    }

    @Test
    void keysThatAreNotGeneratedByTheServiceAreRejected() {
        assertFalse(service.isStoredKey("documents/contract.pdf"));
        assertFalse(service.isStoredKey("../../etc/passwd"));
        assertFalse(service.isStoredKey(null));
        assertFalse(service.exists("documents/contract.pdf"));
        assertThrows(IllegalArgumentException.class, () -> service.resolve("../../etc/passwd"));
    }

    @Test
    void deleteRemovesTheFileAndIgnoresMissingOnes() throws Exception {
        String key = service.newKey(FIRM, CASE);
        service.store(key, new ByteArrayInputStream("x".getBytes(StandardCharsets.UTF_8)));

        service.deleteQuietly(key);
        service.deleteQuietly(key);
        service.deleteQuietly("not-a-key");

        assertFalse(service.exists(key));
    }
}
