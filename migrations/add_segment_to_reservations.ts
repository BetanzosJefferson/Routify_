import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migración para añadir las columnas segmentOrigin y segmentDestination a la tabla reservations
 * Estas columnas permitirán personalizar el origen y destino de una reservación
 */
export async function addSegmentToReservations() {
  console.log("Iniciando migración: Agregar campos segmentOrigin y segmentDestination a reservations");
  
  try {
    // Verificar si las columnas ya existen
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
      AND column_name IN ('segment_origin', 'segment_destination')
    `);
    
    const existingColumns = checkColumns.rows.map((row: any) => row.column_name);
    
    // Agregar columna segment_origin si no existe
    if (!existingColumns.includes('segment_origin')) {
      await db.execute(sql`
        ALTER TABLE reservations 
        ADD COLUMN segment_origin TEXT
      `);
      console.log("Columna segment_origin agregada a la tabla reservations");
    } else {
      console.log("La columna segment_origin ya existe en la tabla reservations");
    }
    
    // Agregar columna segment_destination si no existe
    if (!existingColumns.includes('segment_destination')) {
      await db.execute(sql`
        ALTER TABLE reservations 
        ADD COLUMN segment_destination TEXT
      `);
      console.log("Columna segment_destination agregada a la tabla reservations");
    } else {
      console.log("La columna segment_destination ya existe en la tabla reservations");
    }
    
    console.log("Migración completada: campos segment_origin y segment_destination agregados a reservations");
    
  } catch (error) {
    console.error("Error durante la migración:", error);
    throw error;
  }
}