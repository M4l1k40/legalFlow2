-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS deadlines (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    case_id uuid NOT NULL,
    title varchar(255) NOT NULL,
    description varchar(2000),
    due_date timestamp(6) NOT NULL,
    priority varchar(32) NOT NULL,
    status varchar(32) NOT NULL,
    created_by varchar(255),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS deadline_notification_events (
    id uuid NOT NULL,
    deadline_id uuid NOT NULL,
    event_key varchar(64) NOT NULL,
    created_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_deadline_notification_event UNIQUE (deadline_id, event_key)
);
CREATE INDEX IF NOT EXISTS idx_deadlines_law_firm_id ON deadlines (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_case_id ON deadlines (case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_law_firm_case ON deadlines (law_firm_id, case_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_law_firm_due_date ON deadlines (law_firm_id, due_date);
