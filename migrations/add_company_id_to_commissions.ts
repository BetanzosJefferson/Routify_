import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

export async function addCompanyIdToCommissions() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Verificar si la columna ya existe
    const checkColumnQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'commissions' AND column_name = 'company_id'
    `;
    const columnExists = await db.execute(checkColumnQuery);

    if (columnExists.rows.length === 0) {
      // Agregar columna companyId a la tabla commissions
      const alterTableQuery = sql`
        ALTER TABLE commissions
        ADD COLUMN company_id TEXT
      `;
      await db.execute(alterTableQuery);
      console.log("Columna company_id agregada a la tabla commissions");
    } else {
      console.log("La columna company_id ya existe en la tabla commissions");
    }

    // Cerrar la conexión a la base de datos
    await pool.end();
    return { success: true, message: "Migración de tabla de comisiones completada exitosamente" };
  } catch (error) {
    console.error("Error al agregar companyId a las comisiones:", error);
    await pool.end();
    throw error;
  }
}

// Si se ejecuta directamente (no como importación)
// En ES modules no hay un 'require.main === module', por lo que simplemente
// exportamos la función para que sea llamada desde run_company_isolation.ts
// La función anterior reemplaza esto