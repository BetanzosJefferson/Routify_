-- Agregar columnas para uso de asientos en la tabla packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS uses_seats BOOLEAN DEFAULT FALSE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS seats_quantity INTEGER DEFAULT 0;