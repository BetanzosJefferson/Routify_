-- Migración para añadir columnas de control de escaneo de tickets
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_by INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS check_count INTEGER DEFAULT 0;