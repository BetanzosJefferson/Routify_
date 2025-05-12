-- Añadir campo markedAsPaidAt a la tabla reservations
ALTER TABLE IF EXISTS reservations
ADD COLUMN IF NOT EXISTS marked_as_paid_at TIMESTAMP;