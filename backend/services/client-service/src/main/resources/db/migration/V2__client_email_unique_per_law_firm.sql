-- SEC-09 : l'unicité de l'email devient propre à chaque cabinet (elle était globale : un cabinet pouvait deviner
-- l'existence d'un email chez un autre). On retire toute contrainte d'unicité portant sur la seule colonne email,
-- quel que soit son nom (celui généré par Hibernate sur les bases existantes diffère de celui de V1).
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'clients'::regclass AND c.contype = 'u'
          AND (SELECT array_agg(a.attname::text) FROM unnest(c.conkey) k JOIN pg_attribute a
               ON a.attrelid = c.conrelid AND a.attnum = k) = ARRAY['email']
    LOOP
        EXECUTE format('ALTER TABLE clients DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE clients ADD CONSTRAINT uk_clients_law_firm_email UNIQUE (law_firm_id, email);
CREATE INDEX IF NOT EXISTS idx_clients_law_firm ON clients (law_firm_id);
