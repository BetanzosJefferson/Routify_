// Script para aplicar mejoras de aislamiento de datos por compañía
import { execSync } from 'child_process';

console.log("Iniciando aplicación de mejoras de aislamiento de datos por compañía...");

try {
  // Instalar bcryptjs si no está instalado (para el hash de contraseñas)
  console.log("Instalando dependencias necesarias...");
  execSync('npm install bcryptjs', { stdio: 'inherit' });
  
  // Aplicar migración de base de datos para agregar los campos companyId necesarios
  console.log("\nEjecutando migración de esquema de base de datos...");
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
  
  // Ejecutar script para crear usuarios de prueba y actualizar datos existentes
  console.log("\nEjecutando script de aislamiento de datos...");
  execSync('npx tsx migrations/run_company_isolation.ts', { stdio: 'inherit' });
  
  console.log("\n✅ El proceso de implementación de aislamiento de datos por compañía se ha completado exitosamente.");
  console.log("\nAhora puedes iniciar sesión con cualquiera de los siguientes usuarios de prueba:");
  console.log("- Dueño Viaja Fácil: owner@viajafacil.com / owner123456");
  console.log("- Admin Viaja Fácil: admin@viajafacil.com / admin123456");
  console.log("- Centro de llamadas Viaja Fácil: callcenter@viajafacil.com / call123456");
  console.log("- Checador Viaja Fácil: checker@viajafacil.com / checker123456");
  console.log("- Chofer Viaja Fácil: driver@viajafacil.com / driver123456");
  console.log("- Taquilla Viaja Fácil: office@viajafacil.com / office123456");
  console.log("- Dueño BAMO: owner@bamo.com / owner123456");
  console.log("- Admin BAMO: admin@bamo.com / admin123456");
  
} catch (error) {
  console.error("❌ Error durante el proceso de implementación:", error);
  process.exit(1);
}