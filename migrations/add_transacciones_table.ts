import { db } from '../server/db';
import * as schema from '../shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Creando tabla de transacciones...');
  
  try {
    // Verificar si la tabla ya existe
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'transacciones'
    `);
    
    const tables = tablesResult.rows;
    if (tables.length > 0) {
      console.log('La tabla "transacciones" ya existe. Omitiendo creación.');
      return;
    }
    
    // Crear la tabla transacciones
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transacciones (
        id SERIAL PRIMARY KEY,
        detalles JSONB NOT NULL,
        usuario_id INTEGER NOT NULL REFERENCES users(id),
        id_corte INTEGER REFERENCES cashbox_cutoffs(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log('Tabla "transacciones" creada exitosamente.');
  } catch (error) {
    console.error('Error al crear la tabla "transacciones":', error);
    throw error;
  }
}

main()
  .then(() => console.log('Migración completada exitosamente.'))
  .catch((error) => console.error('Error en la migración:', error))
  .finally(() => process.exit());