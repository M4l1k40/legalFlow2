-- Schéma initial : équivalent de ce que Hibernate (ddl-auto=update) créait jusqu'ici.
-- Sur une base existante, Flyway la « baseline » à la version 1 sans rejouer ce script.
CREATE TABLE IF NOT EXISTS clients (
    id uuid NOT NULL,
    law_firm_id uuid NOT NULL,
    first_name varchar(255) NOT NULL,
    last_name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    phone varchar(255),
    address varchar(500),
    created_at timestamp(6) NOT NULL,
    updated_at timestamp(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_clients_email UNIQUE (email)
);
CREATE TABLE IF NOT EXISTS client_lawyers (
    client_id uuid NOT NULL,
    lawyer_id uuid NOT NULL,
    PRIMARY KEY (client_id, lawyer_id),
    CONSTRAINT fk_client_lawyers_client FOREIGN KEY (client_id) REFERENCES clients (id)
);
