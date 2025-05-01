import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

// Configurar WebSocket para Neon Serverless
neonConfig.webSocketConstructor = ws;

export async function addCommissionPercentageToUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Verificar si la columna ya existe
    const checkColumnQuery = sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'commission_percentage'
    `;
    const columnExists = await db.execute(checkColumnQuery);

    if (columnExists.rows.length === 0) {
      // Agregar columna commission_percentage a la tabla users
      const alterTableQuery = sql`
        ALTER TABLE users
        ADD COLUMN commission_percentage DOUBLE PRECISION DEFAULT 0
      `;
      await db.execute(alterTableQuery);
      console.log("Columna commission_percentage agregada a la tabla users");
    } else {
      console.log("La columna commission_percentage ya existe en la tabla users");
    }

    // Cerrar la conexión a la base de datos
    await pool.end();
    return { success: true, message: "Migración de porcentaje de comisión para usuarios completada exitosamente" };
  } catch (error) {
    console.error("Error al agregar commission_percentage a los usuarios:", error);
    await pool.end();
    throw error;
  }
}