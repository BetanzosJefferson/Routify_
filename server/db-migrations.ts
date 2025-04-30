import { addVehicleDriverToTrips } from "../migrations/add_vehicle_driver_to_trips";
import { addCompanyIdToReservations } from "../migrations/add_company_id_to_reservations";
import { addCompanyIdToCommissions } from "../migrations/add_company_id_to_commissions";
import { addSegmentToReservations } from "../migrations/add_segment_to_reservations";

export async function runMigrations() {
  try {
    console.log("Iniciando migraciones de base de datos...");
    
    // Ejecutar migración para añadir vehicleId y driverId a los viajes
    await addVehicleDriverToTrips();
    
    // Ejecutar migración para añadir companyId a las reservaciones
    await addCompanyIdToReservations();
    
    // Ejecutar migración para añadir companyId a las comisiones
    await addCompanyIdToCommissions();
    
    // Ejecutar migración para añadir segmentOrigin y segmentDestination a las reservaciones
    await addSegmentToReservations();
    
    console.log("Migraciones de base de datos completadas exitosamente");
  } catch (error) {
    console.error("Error al ejecutar migraciones:", error);
  }
}