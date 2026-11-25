package com.legalflow.document.storage;

import java.io.InputStream;

/** Stockage binaire des documents. L'implémentation de production est MinIO ; les tests utilisent une version en mémoire. */
public interface FileStorage {

    /** Enregistre le contenu sous la clé donnée (la clé est toujours générée par le serveur). */
    void put(String key, InputStream content, long size, String contentType);

    /** Ouvre le contenu ; l'appelant doit fermer le flux. */
    InputStream get(String key);

    /** Supprime l'objet ; sans effet s'il n'existe pas. */
    void delete(String key);
}
