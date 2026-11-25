-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS invoices (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    case_id uuid NOT NULL,
    client_id uuid NOT NULL,
    invoice_number varchar(100) NOT NULL,
    description varchar(255) NOT NULL,
    amount numeric(19,2) NOT NULL,
    due_date date NOT NULL,
    status varchar(32) NOT NULL,
    created_by varchar(255),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_invoices_invoice_number UNIQUE (invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_law_firm_id ON invoices (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_invoices_case_id ON invoices (case_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date);
