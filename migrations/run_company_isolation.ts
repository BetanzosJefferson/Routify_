import { addCompanyIdToReservations } from "./add_company_id_to_reservations";
import { addCompanyIdToCommissions } from "./add_company_id_to_commissions";
import { createTestUsers } from "./create_test_users";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Iniciando proceso de aislamiento de datos por compañía...");
    
    // Paso 1: Actualizar la estructura de la tabla de reservaciones
    const reservationMigration = await addCompanyIdToReservations();
    console.log(reservationMigration.message);
    
    // Paso 2: Actualizar la estructura de la tabla de comisiones
    const commissionMigration = await addCompanyIdToCommissions();
    console.log(commissionMigration.message);
    
    // Paso 3: Crear usuarios de prueba para cada rol
    const usersCreation = await createTestUsers();
    console.log(usersCreation.message);
    
    // Paso 4: Asignar companyId a las rutas existentes (para pruebas)
    await updateExistingRoutes();
    
    // Paso 5: Asignar companyId a los viajes existentes (para pruebas)
    await updateExistingTrips();
    
    // Paso 6: Asignar companyId a los vehículos existentes (para pruebas)
    await updateExistingVehicles();
    
    // Paso 7: Asignar companyId a las comisiones existentes (para pruebas)
    await updateExistingCommissions();
    
    console.log("Proceso de aislamiento de datos por compañía completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("Error durante el proceso:", error);
    process.exit(1);
  }
}

async function updateExistingRoutes() {
  try {
    console.log("Actualizando rutas existentes con companyId...");
    
    // Obtener el total de rutas sin companyId
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM routes WHERE company_id IS NULL
    `);
    
    if (result.rows.length > 0 && parseInt(result.rows[0].count as string) === 0) {
      console.log("No hay rutas que requieran actualización de companyId");
      return;
    }
    
    // Asignar la mitad de las rutas a Viaja Fácil y la otra mitad a BAMO
    await db.execute(sql`
      UPDATE routes 
      SET company_id = 'viaja-facil-123' 
      WHERE id % 2 = 0 AND company_id IS NULL
    `);
    
    await db.execute(sql`
      UPDATE routes 
      SET company_id = 'bamo-456' 
      WHERE id % 2 = 1 AND company_id IS NULL
    `);
    
    console.log("Rutas actualizadas correctamente con companyId");
  } catch (error) {
    console.error("Error al actualizar rutas:", error);
  }
}

async function updateExistingTrips() {
  try {
    console.log("Actualizando viajes existentes con companyId...");
    
    // Primero, asignar el companyId de las rutas a los viajes relacionados
    await db.execute(sql`
      UPDATE trips t
      SET company_id = r.company_id
      FROM routes r
      WHERE t.route_id = r.id AND r.company_id IS NOT NULL AND t.company_id IS NULL
    `);
    
    // Luego, asignar companyId a viajes que aún no tengan, alternando entre las compañías
    await db.execute(sql`
      UPDATE trips 
      SET company_id = 'viaja-facil-123' 
      WHERE id % 2 = 0 AND company_id IS NULL
    `);
    
    await db.execute(sql`
      UPDATE trips 
      SET company_id = 'bamo-456' 
      WHERE id % 2 = 1 AND company_id IS NULL
    `);
    
    console.log("Viajes actualizados correctamente con companyId");
  } catch (error) {
    console.error("Error al actualizar viajes:", error);
  }
}

async function updateExistingVehicles() {
  try {
    console.log("Actualizando vehículos existentes con companyId...");
    
    // Asignar companyId a vehículos que no tengan, alternando entre las compañías
    await db.execute(sql`
      UPDATE vehicles 
      SET company_id = 'viaja-facil-123' 
      WHERE id % 2 = 0 AND company_id IS NULL
    `);
    
    await db.execute(sql`
      UPDATE vehicles 
      SET company_id = 'bamo-456' 
      WHERE id % 2 = 1 AND company_id IS NULL
    `);
    
    console.log("Vehículos actualizados correctamente con companyId");
  } catch (error) {
    console.error("Error al actualizar vehículos:", error);
  }
}

async function updateExistingCommissions() {
  try {
    console.log("Actualizando comisiones existentes con companyId...");
    
    // Primero, intentar asignar companyId basado en la ruta asociada
    await db.execute(sql`
      UPDATE commissions c
      SET company_id = r.company_id
      FROM routes r
      WHERE c.route_id = r.id AND r.company_id IS NOT NULL AND c.company_id IS NULL
    `);
    
    // Luego, intentar asignar companyId basado en el viaje asociado
    await db.execute(sql`
      UPDATE commissions c
      SET company_id = t.company_id
      FROM trips t
      WHERE c.trip_id = t.id AND t.company_id IS NOT NULL AND c.company_id IS NULL
    `);
    
    // Finalmente, asignar companyId a comisiones que aún no tengan, alternando entre las compañías
    await db.execute(sql`
      UPDATE commissions 
      SET company_id = 'viaja-facil-123' 
      WHERE id % 2 = 0 AND company_id IS NULL
    `);
    
    await db.execute(sql`
      UPDATE commissions 
      SET company_id = 'bamo-456' 
      WHERE id % 2 = 1 AND company_id IS NULL
    `);
    
    console.log("Comisiones actualizadas correctamente con companyId");
  } catch (error) {
    console.error("Error al actualizar comisiones:", error);
  }
}

// Ejecutar el script principal
main();