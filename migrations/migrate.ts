import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { addVehicleDriverToTrips } from "./add_vehicle_driver_to_trips";

// Función principal que ejecuta todas las migraciones en secuencia
async function runMigrations() {
  console.log("Iniciando migraciones...");
  
  try {
    // Añadir columna invited_by_id a la tabla users
    console.log("Agregando columna invited_by_id a la tabla users...");
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS invited_by_id INTEGER REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT ''
    `);
    console.log("Columnas agregadas exitosamente.");
    
    // Añadir columnas vehicleId y driverId a la tabla trips
    await addVehicleDriverToTrips();

    console.log("Migraciones completadas con éxito.");
  } catch (error) {
    console.error("Error durante las migraciones:", error);
    process.exit(1);
  }
}

// Ejecutar las migraciones
runMigrations()
  .then(() => {
    console.log("Proceso de migración finalizado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error en el script de migración:", err);
    process.exit(1);
  });