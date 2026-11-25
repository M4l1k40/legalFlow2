-- SEC-10 : tribunaux rattachés à un cabinet. Les lignes existantes gardent law_firm_id NULL : ce sont des données de
-- référence partagées, visibles de tous les cabinets en lecture seule ; chaque cabinet crée désormais les siennes.
ALTER TABLE courts ADD COLUMN IF NOT EXISTS law_firm_id uuid;
CREATE INDEX IF NOT EXISTS idx_courts_law_firm ON courts (law_firm_id);
