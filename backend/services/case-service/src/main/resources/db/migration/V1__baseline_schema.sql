-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS legal_cases (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    client_id uuid NOT NULL,
    lawyer_id uuid NOT NULL,
    reference varchar(255) NOT NULL,
    title varchar(255) NOT NULL,
    description varchar(2000),
    status varchar(255) NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS case_events (
    id uuid NOT NULL,
    case_id uuid NOT NULL,
    type varchar(255) NOT NULL,
    description varchar(2000),
    created_at timestamp(6) NOT NULL,
    created_by varchar(255),
    legal_case_id uuid NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_case_events_legal_case FOREIGN KEY (legal_case_id) REFERENCES legal_cases (id)
);
CREATE INDEX IF NOT EXISTS idx_legal_cases_law_firm ON legal_cases (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_case_events_legal_case ON case_events (legal_case_id);
