-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS consultations (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    client_id uuid NOT NULL,
    lawyer_id uuid,
    subject varchar(255) NOT NULL,
    description varchar(4000) NOT NULL,
    status varchar(32) NOT NULL,
    answer varchar(4000),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    answered_at timestamp(6),
    closed_at timestamp(6),
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_consultations_law_firm_id ON consultations (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_consultations_client_id ON consultations (client_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations (status);
CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_id ON consultations (lawyer_id);
