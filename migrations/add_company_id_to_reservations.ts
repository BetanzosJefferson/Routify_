import { db } from "../server/db";
import { sql } from "drizzle-orm";

export async function addCompanyIdToReservations() {
  try {
    console.log("Iniciando migración: Añadiendo campo company_id a la tabla de reservaciones...");
    
    // Verificar si la columna ya existe
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='reservations' AND column_name='company_id'
    `);
    
    if (checkColumn.rows.length === 0) {
      // La columna no existe, proceder a crearla
      await db.execute(sql`
        ALTER TABLE reservations
        ADD COLUMN company_id TEXT
      `);
      
      console.log("Campo company_id añadido correctamente a la tabla reservations");

      // Actualizar las reservaciones existentes con el companyId del viaje asociado
      console.log("Actualizando reservaciones existentes para heredar el companyId de sus viajes...");
      
      await db.execute(sql`
        UPDATE reservations r
        SET company_id = t.company_id
        FROM trips t
        WHERE r.trip_id = t.id AND t.company_id IS NOT NULL
      `);
      
      console.log("Actualización de campo company_id en reservaciones completada");
      
      return { success: true, message: "Migración completada correctamente" };
    } else {
      console.log("El campo company_id ya existe en la tabla reservations. No se requiere migración.");
      return { success: true, message: "No se requiere migración" };
    }
  } catch (error) {
    console.error("Error durante la migración:", error);
    return { success: false, message: `Error durante la migración: ${error}` };
  }
}