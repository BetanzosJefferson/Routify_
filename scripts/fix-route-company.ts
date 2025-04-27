import { pool, db } from "../server/db";
import { sql } from "drizzle-orm";

async function fixRouteCompany() {
  try {
    console.log("Iniciando corrección de rutas sin compañía...");
    
    // Usar SQL nativo para encontrar y actualizar rutas sin compañía
    const result = await db.execute(sql`
      UPDATE routes 
      SET company_id = 'viaja-facil-123' 
      WHERE company_id IS NULL OR company_id = ''
      RETURNING id, name, company_id
    `);
    
    console.log("Resultado de actualización:", result);
    console.log("Proceso completado exitosamente.");
  } catch (error) {
    console.error("Error al actualizar rutas:", error);
  } finally {
    // Cerrar conexión a la base de datos
    await pool.end();
    process.exit(0);
  }
}

fixRouteCompany();