// Script para crear un cupón de prueba
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');
const { neonConfig } = require('@neondatabase/serverless');

neonConfig.webSocketConstructor = ws;

// Configurar la conexión a la BD
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTestCoupon() {
  try {
    // Verificar si ya existe el cupón TEST123
    const existingCoupon = await pool.query(
      'SELECT * FROM coupons WHERE code = $1',
      ['TEST50']
    );

    if (existingCoupon.rows.length > 0) {
      console.log('El cupón de prueba TEST50 ya existe. No es necesario crearlo nuevamente.');
      console.log('Detalles del cupón:');
      console.log(existingCoupon.rows[0]);
      return;
    }

    // Fecha actual
    const now = new Date();
    
    // Fecha de expiración (7 días desde ahora)
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + 7);

    // Insertar un cupón de prueba
    const result = await pool.query(
      `INSERT INTO coupons 
       (code, discount_type, discount_value, duration, created_at, expires_at, used_count, is_active, company_id, created_by_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        'TEST50',             // Código del cupón
        'percentage',         // Tipo de descuento: percentage o fixed
        50,                   // Valor del descuento (50%)
        '7d',                 // Duración (7 días)
        now,                  // Fecha de creación
        expiresAt,            // Fecha de expiración
        0,                    // Contador de usos
        true,                 // Activo
        'all',                // ID de compañía (all para que funcione en cualquier compañía)
        1                     // ID del creador (1 para el admin)
      ]
    );

    console.log('Cupón de prueba creado exitosamente:');
    console.log(result.rows[0]);
  } catch (error) {
    console.error('Error al crear el cupón de prueba:', error);
  } finally {
    // Cerrar la conexión
    await pool.end();
  }
}

// Ejecutar la función
createTestCoupon();