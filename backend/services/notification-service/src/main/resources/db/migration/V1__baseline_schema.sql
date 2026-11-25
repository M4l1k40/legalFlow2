-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS notifications (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    event_id uuid,
    recipient_type varchar(24),
    channel varchar(24),
    subject varchar(160),
    status varchar(16),
    type varchar(48) NOT NULL,
    title varchar(160) NOT NULL,
    message varchar(2000) NOT NULL,
    reference_type varchar(64),
    reference_id uuid,
    is_read boolean NOT NULL,
    created_at timestamp(6) NOT NULL,
    sent_at timestamp(6),
    error_message varchar(1000),
    read_at timestamp(6),
    PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS processed_events (
    event_id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    event_type varchar(64) NOT NULL,
    status varchar(16) NOT NULL,
    processed_at timestamp(6) with time zone NOT NULL,
    PRIMARY KEY (event_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_law_firm_id ON notifications (law_firm_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient ON notifications (law_firm_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient_read ON notifications (law_firm_id, recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient_created ON notifications (law_firm_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_notifications_event_recipient_channel ON notifications (event_id, law_firm_id, recipient_id, channel);
