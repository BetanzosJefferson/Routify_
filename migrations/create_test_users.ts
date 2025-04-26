import { db } from "../server/db";
import { UserRole, users } from "../shared/schema";
import { sql } from "drizzle-orm";

// Función para generar hash de contraseña (copia de la función en auth.ts)
async function hashPassword(password: string) {
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  company: string;
  companyId: string;
}

export async function createTestUsers() {
  try {
    console.log("Iniciando creación de usuarios de prueba...");
    
    // Definir compañías de prueba
    const companies = [
      { name: "Viaja Fácil", id: "viaja-facil-123" },
      { name: "BAMO", id: "bamo-456" },
      { name: "Transportes Guerrero", id: "trans-guerrero-789" }
    ];
    
    // Definir usuarios de prueba para cada rol
    const testUsers: TestUser[] = [
      // Usuarios de Viaja Fácil
      {
        firstName: "Carlos",
        lastName: "Ramírez",
        email: "owner@viajafacil.com",
        password: await hashPassword("owner123456"),
        role: UserRole.OWNER,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      {
        firstName: "María",
        lastName: "López",
        email: "admin@viajafacil.com",
        password: await hashPassword("admin123456"),
        role: UserRole.ADMIN,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      {
        firstName: "Juan",
        lastName: "García",
        email: "callcenter@viajafacil.com",
        password: await hashPassword("call123456"),
        role: UserRole.CALL_CENTER,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      {
        firstName: "Roberto",
        lastName: "Martínez",
        email: "checker@viajafacil.com",
        password: await hashPassword("checker123456"),
        role: UserRole.CHECKER,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      {
        firstName: "Laura",
        lastName: "Sánchez",
        email: "driver@viajafacil.com",
        password: await hashPassword("driver123456"),
        role: UserRole.DRIVER,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      {
        firstName: "Miguel",
        lastName: "Hernández",
        email: "office@viajafacil.com",
        password: await hashPassword("office123456"),
        role: UserRole.TICKET_OFFICE,
        company: "Viaja Fácil",
        companyId: companies[0].id
      },
      
      // Usuarios de BAMO
      {
        firstName: "Sofía",
        lastName: "Betanzos",
        email: "owner@bamo.com",
        password: await hashPassword("owner123456"),
        role: UserRole.OWNER,
        company: "BAMO",
        companyId: companies[1].id
      },
      {
        firstName: "Daniel",
        lastName: "Juárez",
        email: "admin@bamo.com",
        password: await hashPassword("admin123456"),
        role: UserRole.ADMIN,
        company: "BAMO",
        companyId: companies[1].id
      }
    ];
    
    // Verificar si los usuarios ya existen y crear sólo los que no existen
    for (const userData of testUsers) {
      // Verificar si el usuario ya existe
      const existingUser = await db.execute(sql`
        SELECT * FROM users WHERE email = ${userData.email}
      `);
      
      if (existingUser.rows.length === 0) {
        // El usuario no existe, proceder a crearlo
        await db.execute(sql`
          INSERT INTO users (
            first_name, last_name, email, password, role, company, profile_picture, 
            created_at, updated_at, company_id
          ) VALUES (
            ${userData.firstName}, ${userData.lastName}, ${userData.email}, ${userData.password},
            ${userData.role}, ${userData.company}, '', 
            ${new Date().toISOString()}, ${new Date().toISOString()}, ${userData.companyId}
          )
        `);
        
        console.log(`Usuario creado: ${userData.firstName} ${userData.lastName} (${userData.role}) para la compañía ${userData.company}`);
      } else {
        console.log(`El usuario ${userData.email} ya existe. Omitiendo creación.`);
      }
    }
    
    console.log("Proceso de creación de usuarios de prueba completado");
    
    return { success: true, message: "Usuarios de prueba creados correctamente" };
  } catch (error) {
    console.error("Error durante la creación de usuarios de prueba:", error);
    return { success: false, message: `Error durante la creación de usuarios: ${error}` };
  }
}