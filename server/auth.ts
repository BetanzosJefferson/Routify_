import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, insertUserSchema, insertInvitationSchema, invitations, UserRole } from "@shared/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { add } from "date-fns";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuthRoutes(app: Express) {
  // Crear un usuario SuperAdmin inicial si no existe ninguno
  async function createInitialSuperAdmin() {
    const superAdminExists = await db
      .select()
      .from(users)
      .where(eq(users.role, UserRole.SUPER_ADMIN))
      .limit(1);

    if (superAdminExists.length === 0) {
      await db.insert(users).values({
        firstName: "Admin",
        lastName: "Principal",
        email: "admin@transporte.com",
        password: await hashPassword("admin123456"),
        role: UserRole.SUPER_ADMIN,
      });
      console.log("Usuario Super Admin creado con éxito");
    }
  }

  // Función para crear un superAdmin adicional
  async function createAdditionalSuperAdmin(email: string, password: string) {
    // Verificar si el usuario ya existe
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log(`El usuario con email ${email} ya existe`);
      return false;
    }

    // Crear el nuevo superAdmin
    await db.insert(users).values({
      firstName: "William",
      lastName: "Jefferson",
      email: email,
      password: await hashPassword(password),
      role: UserRole.SUPER_ADMIN,
    });
    console.log(`Nuevo Super Admin creado con éxito: ${email}`);
    return true;
  }

  // Crear William Jefferson como superAdmin
  createAdditionalSuperAdmin("bahenawilliamjefferson@gmail.com", "12345678").catch((err) => {
    console.error("Error al crear superAdmin adicional:", err);
  });

  // Intentar crear el usuario inicial
  createInitialSuperAdmin().catch((err) => {
    console.error("Error al crear usuario inicial:", err);
  });

  // Endpoint para obtener usuarios filtrados por rol y/o compañía
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const { user } = req as any; // Obtener el usuario autenticado desde la sesión
      
      // Si no hay usuario autenticado, devolver error
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      let query = db.select().from(users);
      
      // Filtrar según el rol del usuario autenticado
      if (user.role === UserRole.OWNER) {
        // Los "Dueños" solo ven a los usuarios que ellos han invitado
        query = query.where(eq(users.invitedById, user.id));
      } else if (user.role === UserRole.ADMIN) {
        // Los administradores ven a todos los usuarios excepto los superadmin
        query = query.where(ne(users.role, UserRole.SUPER_ADMIN));
      } else if (user.role !== UserRole.SUPER_ADMIN) {
        // Otros roles solo se ven a sí mismos
        query = query.where(eq(users.id, user.id));
      }
      // Los superadmin ven a todos los usuarios
      
      const filteredUsers = await query;
      res.json(filteredUsers);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      res.status(500).json({ message: "Error al obtener usuarios" });
    }
  });

  // Endpoint para iniciar sesión
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      console.log("Login attempt:", { email });

      if (!email || !password) {
        return res.status(400).json({ message: "Email y contraseña son requeridos" });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user.length === 0) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const isPasswordValid = await comparePasswords(password, user[0].password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      // En un sistema real, aquí generaríamos un JWT o estableceríamos una sesión
      // Por ahora, simplemente devolvemos el usuario (sin la contraseña)
      const { password: _, ...userWithoutPassword } = user[0];
      console.log("Login successful for:", email);
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // Endpoint para crear una invitación
  app.post("/api/invitations", async (req: Request, res: Response) => {
    try {
      const { role, email } = req.body;
      const { user } = req as any; // Obtener el usuario autenticado

      if (!role) {
        return res.status(400).json({ message: "El rol es requerido" });
      }

      // Verificar que el usuario está autenticado
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      // Verificar permisos según el rol
      // Solo los SUPER_ADMIN pueden crear cualquier tipo de usuario
      // Los OWNER solo pueden crear usuarios que no sean SUPER_ADMIN ni OWNER
      // Los ADMIN solo pueden crear usuarios que no sean SUPER_ADMIN, ADMIN ni OWNER
      if (
        (user.role === UserRole.OWNER && (role === UserRole.SUPER_ADMIN || role === UserRole.OWNER)) ||
        (user.role === UserRole.ADMIN && (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.OWNER)) ||
        (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER)
      ) {
        return res.status(403).json({ message: "No tiene permisos para crear este tipo de usuario" });
      }

      // Calcular fecha de expiración (24 horas desde ahora)
      const expiresAt = add(new Date(), { hours: 24 });

      const [invitation] = await db
        .insert(invitations)
        .values({
          role,
          email: email || null,
          expiresAt,
          createdById: user.id, // Usar el ID del usuario autenticado como creador
        })
        .returning();

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error al crear invitación:", error);
      res.status(500).json({ message: "Error al crear invitación" });
    }
  });

  // Endpoint para obtener invitaciones filtradas por rol
  app.get("/api/invitations", async (req: Request, res: Response) => {
    try {
      const { user } = req as any; // Obtener el usuario autenticado desde la sesión
      
      // Si no hay usuario autenticado, devolver error
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      let query = db.select().from(invitations);
      
      // Filtrar según el rol del usuario autenticado
      if (user.role === UserRole.OWNER) {
        // Los "Dueños" solo ven las invitaciones que ellos han creado
        query = query.where(eq(invitations.createdById, user.id));
      } else if (user.role === UserRole.ADMIN) {
        // Los administradores ven todas las invitaciones
        // No necesitamos filtro adicional
      } else if (user.role !== UserRole.SUPER_ADMIN) {
        // Otros roles no ven ninguna invitación (lista vacía)
        return res.json([]);
      }
      // Los superadmin ven todas las invitaciones
      
      const filteredInvitations = await query;
      res.json(filteredInvitations);
    } catch (error) {
      console.error("Error al obtener invitaciones:", error);
      res.status(500).json({ message: "Error al obtener invitaciones" });
    }
  });

  // Endpoint para verificar si una invitación es válida
  app.get("/api/invitations/:token/verify", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      const invitation = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.token, token),
            isNull(invitations.usedAt)
          )
        )
        .limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({ valid: false, message: "Invitación no encontrada o ya utilizada" });
      }

      const now = new Date();
      if (new Date(invitation[0].expiresAt) < now) {
        return res.status(400).json({ valid: false, message: "La invitación ha expirado" });
      }

      res.json({
        valid: true,
        role: invitation[0].role,
        email: invitation[0].email,
      });
    } catch (error) {
      console.error("Error al verificar invitación:", error);
      res.status(500).json({ valid: false, message: "Error al verificar invitación" });
    }
  });

  // Endpoint para registrar un usuario con una invitación
  app.post("/api/register/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { firstName, lastName, email, password, company, profilePicture } = req.body;

      // Verificar si los datos requeridos están presentes
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Todos los campos son requeridos" });
      }

      // Buscar la invitación y verificar que sea válida
      const invitation = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.token, token),
            isNull(invitations.usedAt)
          )
        )
        .limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({ message: "Invitación no encontrada o ya utilizada" });
      }

      const now = new Date();
      if (new Date(invitation[0].expiresAt) < now) {
        return res.status(400).json({ message: "La invitación ha expirado" });
      }

      // Verificar si el correo ya está registrado
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "El correo electrónico ya está registrado" });
      }

      // Validaciones específicas para roles que requieren campos adicionales
      if (invitation[0].role === UserRole.OWNER && !company) {
        return res.status(400).json({ message: "El nombre de la empresa es obligatorio para usuarios con rol Dueño" });
      }
      
      if (invitation[0].role === UserRole.DEVELOPER && !company) {
        return res.status(400).json({ message: "El nombre de la empresa/proyecto es obligatorio para usuarios con rol Desarrollador" });
      }

      // Obtener el usuario invitador
      const inviter = await db
        .select()
        .from(users)
        .where(eq(users.id, invitation[0].createdById))
        .limit(1);
        
      // Si el invitador es un dueño, se usa su foto de perfil y compañía para los invitados
      let companyId = "";
      let profilePictureToUse = profilePicture || "";
      
      if (inviter.length > 0 && inviter[0].role === UserRole.OWNER) {
        companyId = inviter[0].companyId || inviter[0].company; // Usar companyId si existe, si no, usar el valor de company
        
        // Si el usuario que se está registrando NO es un dueño, asignarle la foto de perfil del dueño invitador
        if (invitation[0].role !== UserRole.OWNER && invitation[0].role !== UserRole.SUPER_ADMIN) {
          profilePictureToUse = inviter[0].profilePicture || "";
        }
      }
      
      // Crear el usuario con campos adicionales según el rol
      const userData = {
        firstName,
        lastName,
        email,
        password: await hashPassword(password),
        role: invitation[0].role,
        company: (invitation[0].role === UserRole.OWNER || invitation[0].role === UserRole.DEVELOPER) ? company : "",
        profilePicture: profilePictureToUse,
        invitedById: invitation[0].createdById, // Guardar referencia al usuario que invitó
        companyId: companyId, // Guardar referencia a la compañía
      };

      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();

      // Marcar la invitación como utilizada
      await db
        .update(invitations)
        .set({ usedAt: now })
        .where(eq(invitations.id, invitation[0].id));

      // Ocultar la contraseña en la respuesta
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error en registro:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
}