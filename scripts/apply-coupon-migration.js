#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Iniciando migración para el sistema de cupones...');

    // Iniciar transacción para ejecutar todas las operaciones juntas
    await client.query('BEGIN');

    // 1. Verificar si la tabla coupons ya existe
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'coupons'
      );
    `);
    
    const couponsTableExists = tableCheckResult.rows[0].exists;
    
    if (!couponsTableExists) {
      console.log('Creando tabla coupons...');
      
      // Crear tabla coupons
      await client.query(`
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
      `);
      console.log('Tabla coupons creada correctamente');
    } else {
      console.log('Tabla coupons ya existe, omitiendo creación');
    }
    
    // 2. Verificar si la tabla coupon_applications ya existe
    const appTableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'coupon_applications'
      );
    `);
    
    const couponAppsTableExists = appTableCheckResult.rows[0].exists;
    
    if (!couponAppsTableExists) {
      console.log('Creando tabla coupon_applications...');
      
      // Crear tabla coupon_applications
      await client.query(`
        CREATE TABLE coupon_applications (
          id SERIAL PRIMARY KEY,
          coupon_id INTEGER NOT NULL REFERENCES coupons(id),
          reservation_id INTEGER NOT NULL,
          applied_discount DOUBLE PRECISION NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Tabla coupon_applications creada correctamente');
    } else {
      console.log('Tabla coupon_applications ya existe, omitiendo creación');
    }
    
    // 3. Verificar si las columnas ya existen en la tabla reservations
    const columnsCheckResult = await client.query(`
      SELECT 
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'reservations' AND column_name = 'coupon_id'
        ) as has_coupon_id,
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'reservations' AND column_name = 'discount_amount'
        ) as has_discount_amount;
    `);
    
    const { has_coupon_id, has_discount_amount } = columnsCheckResult.rows[0];
    
    // Agregar columnas a la tabla reservations si no existen
    if (!has_coupon_id) {
      console.log('Agregando columna coupon_id a la tabla reservations...');
      await client.query(`
        ALTER TABLE reservations 
        ADD COLUMN coupon_id INTEGER REFERENCES coupons(id);
      `);
      console.log('Columna coupon_id agregada correctamente');
    } else {
      console.log('Columna coupon_id ya existe en reservations, omitiendo creación');
    }
    
    if (!has_discount_amount) {
      console.log('Agregando columna discount_amount a la tabla reservations...');
      await client.query(`
        ALTER TABLE reservations 
        ADD COLUMN discount_amount DOUBLE PRECISION DEFAULT 0;
      `);
      console.log('Columna discount_amount agregada correctamente');
    } else {
      console.log('Columna discount_amount ya existe en reservations, omitiendo creación');
    }
    
    // Commit de la transacción
    await client.query('COMMIT');
    console.log('Migración completada con éxito');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', e);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});