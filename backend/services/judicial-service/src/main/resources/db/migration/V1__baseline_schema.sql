-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS courts (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    type varchar(255) NOT NULL,
    city varchar(255) NOT NULL,
    address varchar(1000),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS judges (
    id uuid NOT NULL,
    court_id uuid NOT NULL,
    first_name varchar(255) NOT NULL,
    last_name varchar(255) NOT NULL,
    role varchar(255) NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_judges_court FOREIGN KEY (court_id) REFERENCES courts (id)
);
CREATE TABLE IF NOT EXISTS judicial_cases (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    case_id uuid NOT NULL,
    court_id uuid NOT NULL,
    judge_id uuid NOT NULL,
    court_case_number varchar(255) NOT NULL,
    procedure_type varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    opening_date date NOT NULL,
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS hearings (
    id uuid NOT NULL,
    judicial_case_id uuid NOT NULL,
    date_time timestamp(6) NOT NULL,
    type varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    location varchar(500),
    notes varchar(2000),
    next_action varchar(2000),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_hearings_judicial_case FOREIGN KEY (judicial_case_id) REFERENCES judicial_cases (id)
);
CREATE TABLE IF NOT EXISTS judicial_events (
    id uuid NOT NULL,
    type varchar(255) NOT NULL,
    description varchar(2000),
    event_date timestamp(6) NOT NULL,
    created_by varchar(255),
    judicial_case_id uuid NOT NULL,
    created_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_judicial_events_judicial_case FOREIGN KEY (judicial_case_id) REFERENCES judicial_cases (id)
);
CREATE INDEX IF NOT EXISTS idx_judicial_cases_law_firm ON judicial_cases (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_hearings_judicial_case ON hearings (judicial_case_id);
CREATE INDEX IF NOT EXISTS idx_judicial_events_judicial_case ON judicial_events (judicial_case_id);
CREATE INDEX IF NOT EXISTS idx_judges_court ON judges (court_id);
