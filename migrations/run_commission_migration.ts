import { addCommissionPercentageToUsers } from "./add_commission_percentage_to_users";

// Ejecutar la migración
addCommissionPercentageToUsers()
  .then(() => {
    console.log("Migración de porcentaje de comisión completada correctamente.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error al ejecutar la migración:", error);
    process.exit(1);
  });