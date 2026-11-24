package com.legalflow.document.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Stockage des fichiers des documents sur le disque du service (un volume Docker en production locale).
 *
 * Une clé de stockage a toujours la forme {cabinet}/{dossier}/{identifiant aléatoire} : le nom envoyé par
 * l'utilisateur n'entre jamais dans le chemin, ce qui empêche toute sortie du dossier de stockage.
 */
@Service
public class FileStorageService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FileStorageService.class);

    private static final String UUID_REGEX = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final Pattern KEY_PATTERN = Pattern.compile("^" + UUID_REGEX + "/" + UUID_REGEX + "/" + UUID_REGEX + "$");

    private final Path root;

    public FileStorageService(@Value("${legalflow.documents.storage-dir:./data/documents}") String storageDir) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
    }

    /** Préfixe que doit avoir la clé d'un document de ce cabinet et de ce dossier. */
    public static String keyPrefix(UUID lawFirmId, UUID caseId) {
        return lawFirmId + "/" + caseId + "/";
    }

    public String newKey(UUID lawFirmId, UUID caseId) {
        return keyPrefix(lawFirmId, caseId) + UUID.randomUUID();
    }

    /** Vrai si la clé a le format produit par newKey (les anciennes clés libres ne correspondent à aucun fichier). */
    public boolean isStoredKey(String key) {
        return key != null && KEY_PATTERN.matcher(key).matches();
    }

    /** Enregistre le contenu et renvoie sa taille en octets. */
    public long store(String key, InputStream content) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        try {
            Files.copy(content, target);
            return Files.size(target);
        } catch (IOException | RuntimeException exception) {
            Files.deleteIfExists(target);
            throw exception;
        }
    }

    public Path resolve(String key) {
        if (!isStoredKey(key)) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        return path;
    }

    public boolean exists(String key) {
        return isStoredKey(key) && Files.isRegularFile(resolve(key));
    }

    public void deleteQuietly(String key) {
        if (!isStoredKey(key)) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException exception) {
            LOGGER.warn("Could not delete stored file {}", key, exception);
        }
    }
}
