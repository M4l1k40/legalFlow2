-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS appointments (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    case_id uuid,
    client_id uuid NOT NULL,
    lawyer_id uuid NOT NULL,
    date_time timestamp(6) NOT NULL,
    type varchar(32) NOT NULL,
    status varchar(32) NOT NULL,
    location varchar(500),
    notes varchar(2000),
    created_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_appointments_law_firm_id ON appointments (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_appointments_law_firm_case ON appointments (law_firm_id, case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_law_firm_datetime ON appointments (law_firm_id, date_time);
