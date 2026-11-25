-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS documents (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    case_id uuid NOT NULL,
    uploaded_by uuid,
    file_name varchar(255) NOT NULL,
    file_type varchar(255) NOT NULL,
    file_size bigint NOT NULL,
    storage_key varchar(1024) NOT NULL,
    description varchar(2000),
    visibility varchar(32) NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_documents_law_firm_id ON documents (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_law_firm_case ON documents (law_firm_id, case_id);
