import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migración para añadir las columnas vehicleId y driverId a la tabla trips
 * Estas columnas permitirán asignar vehículos y conductores a los viajes
 */
export async function addVehicleDriverToTrips() {
  console.log("Iniciando migración para añadir vehicleId y driverId a la tabla trips...");

  try {
    // Verificar si las columnas ya existen
    const checkVehicleIdColumn = await db.execute(
      sql`SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'trips' 
          AND column_name = 'vehicle_id'`
    );

    const checkDriverIdColumn = await db.execute(
      sql`SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'trips' 
          AND column_name = 'driver_id'`
    );

    // Añadir la columna vehicleId si no existe
    if (!checkVehicleIdColumn.rows?.length) {
      console.log("Añadiendo columna vehicle_id a la tabla trips...");
      await db.execute(
        sql`ALTER TABLE trips ADD COLUMN vehicle_id INTEGER`
      );
      console.log("Columna vehicle_id añadida con éxito");
    } else {
      console.log("La columna vehicle_id ya existe en la tabla trips");
    }

    // Añadir la columna driverId si no existe
    if (!checkDriverIdColumn.rows?.length) {
      console.log("Añadiendo columna driver_id a la tabla trips...");
      await db.execute(
        sql`ALTER TABLE trips ADD COLUMN driver_id INTEGER`
      );
      console.log("Columna driver_id añadida con éxito");
    } else {
      console.log("La columna driver_id ya existe en la tabla trips");
    }

    console.log("Migración completada con éxito");
  } catch (error) {
    console.error("Error al ejecutar la migración:", error);
    throw error;
  }
}