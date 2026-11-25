-- Rappel unique 24 h avant le rendez-vous (APPOINTMENT_REMINDER) : date d'envoi du rappel.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp(6);
