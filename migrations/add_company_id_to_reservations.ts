// Migración para añadir el campo companyId a las reservaciones existentes en base al viaje relacionado

import { db } from "../server/db";
import { sql } from "drizzle-orm";

export async function addCompanyIdToReservations() {
  try {
    console.log("Iniciando migración para añadir companyId a las reservaciones existentes...");
    
    // Verificar cuántas reservaciones no tienen companyId
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM reservations WHERE company_id IS NULL
    `);
    
    const count = parseInt(countResult.rows[0].count as string);
    console.log(`Encontradas ${count} reservaciones sin companyId`);
    
    if (count === 0) {
      console.log("No hay reservaciones que requieran actualización");
      return { success: true, message: "No hay reservaciones que requieran actualización" };
    }
    
    // Actualizar reservaciones usando el companyId del viaje relacionado
    const updateResult = await db.execute(sql`
      UPDATE reservations r
      SET company_id = t.company_id
      FROM trips t
      WHERE r.trip_id = t.id 
        AND t.company_id IS NOT NULL 
        AND r.company_id IS NULL
    `);
    
    console.log(`Reservaciones actualizadas: ${updateResult.rowCount || 0}`);
    
    // Verificar cuántas reservaciones quedan sin companyId
    const remainingResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM reservations WHERE company_id IS NULL
    `);
    
    const remaining = parseInt(remainingResult.rows[0].count as string);
    
    if (remaining > 0) {
      console.log(`Quedan ${remaining} reservaciones sin companyId`);
      console.log("Asignando la mitad a cada compañía...");
      
      // Asignar la mitad de las reservaciones restantes a la compañía "viaja-facil-123"
      await db.execute(sql`
        UPDATE reservations 
        SET company_id = 'viaja-facil-123' 
        WHERE id % 2 = 0 AND company_id IS NULL
      `);
      
      // Asignar la otra mitad a la compañía "bamo-456"
      await db.execute(sql`
        UPDATE reservations 
        SET company_id = 'bamo-456' 
        WHERE id % 2 = 1 AND company_id IS NULL
      `);
      
      console.log("Reservaciones restantes actualizadas");
    }
    
    // Verificar que todas las reservaciones tengan companyId
    const finalCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM reservations WHERE company_id IS NULL
    `);
    
    const finalCount = parseInt(finalCheck.rows[0].count as string);
    
    if (finalCount === 0) {
      console.log("✅ Todas las reservaciones tienen companyId ahora");
      return { success: true, message: "Migración completada con éxito" };
    } else {
      console.error(`❌ Aún quedan ${finalCount} reservaciones sin companyId`);
      return { success: false, message: `Aún quedan ${finalCount} reservaciones sin companyId` };
    }
    
  } catch (error) {
    console.error("Error durante la migración:", error);
    return { success: false, message: `Error durante la migración: ${error}` };
  }
}