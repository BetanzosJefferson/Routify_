-- Verificar y crear la tabla de cupones si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'coupons'
  ) THEN
    CREATE TABLE coupons (
      id SERIAL PRIMARY KEY,
      code VARCHAR(5) NOT NULL UNIQUE,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value DOUBLE PRECISION NOT NULL,
      duration TEXT NOT NULL DEFAULT '24hours',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP,
      used_count INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      company_id TEXT NOT NULL,
      created_by_id INTEGER NOT NULL
    );
    RAISE NOTICE 'Tabla coupons creada correctamente';
  ELSE
    RAISE NOTICE 'Tabla coupons ya existe, omitiendo creación';
  END IF;
END
$$;

-- Verificar y crear la tabla de aplicaciones de cupones si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'coupon_applications'
  ) THEN
    CREATE TABLE coupon_applications (
      id SERIAL PRIMARY KEY,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id),
      reservation_id INTEGER NOT NULL,
      applied_discount DOUBLE PRECISION NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    RAISE NOTICE 'Tabla coupon_applications creada correctamente';
  ELSE
    RAISE NOTICE 'Tabla coupon_applications ya existe, omitiendo creación';
  END IF;
END
$$;

-- Verificar y agregar columnas a la tabla reservations si no existen
DO $$
BEGIN
  -- Verificar y agregar coupon_id
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'coupon_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN coupon_id INTEGER REFERENCES coupons(id);
    RAISE NOTICE 'Columna coupon_id agregada correctamente a reservations';
  ELSE
    RAISE NOTICE 'Columna coupon_id ya existe en reservations, omitiendo creación';
  END IF;
  
  -- Verificar y agregar discount_amount
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE reservations ADD COLUMN discount_amount DOUBLE PRECISION DEFAULT 0;
    RAISE NOTICE 'Columna discount_amount agregada correctamente a reservations';
  ELSE
    RAISE NOTICE 'Columna discount_amount ya existe en reservations, omitiendo creación';
  END IF;
END
$$;