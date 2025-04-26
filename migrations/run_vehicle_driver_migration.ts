import { addVehicleDriverToTrips } from "./add_vehicle_driver_to_trips";

// Ejecutar la migración
addVehicleDriverToTrips()
  .then(() => {
    console.log("Migración de vehículos y conductores completada correctamente.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error al ejecutar la migración:", error);
    process.exit(1);
  });