import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, insertUserSchema, insertInvitationSchema, invitations, UserRole, companies } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
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

  // Intentar crear el usuario inicial
  createInitialSuperAdmin().catch((err) => {
    console.error("Error al crear usuario inicial:", err);
  });

  // Endpoint para obtener todos los usuarios
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
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
      const { role, email, createdById } = req.body;

      if (!role) {
        return res.status(400).json({ message: "El rol es requerido" });
      }
      
      // Verificar que el rol es válido
      const validRoles = Object.values(UserRole);
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Rol inválido" });
      }

      // Obtenemos el usuario que está creando la invitación
      let creatorId: number;
      
      if (createdById) {
        // Si se proporciona el ID del creador, lo usamos
        creatorId = createdById;
      } else {
        // Por defecto, usamos al primer SuperAdmin
        const admin = await db
          .select()
          .from(users)
          .where(eq(users.role, UserRole.SUPER_ADMIN))
          .limit(1);

        if (admin.length === 0) {
          return res.status(500).json({ message: "No se encontró un administrador para crear la invitación" });
        }
        creatorId = admin[0].id;
      }

      // Verificar permisos: Solo SuperAdmin puede crear invitaciones para dueños de empresa
      if (role === UserRole.COMPANY_OWNER) {
        // Verificar que el creador es un SuperAdmin
        const creator = await db
          .select()
          .from(users)
          .where(eq(users.id, creatorId))
          .limit(1);
          
        if (creator.length === 0 || creator[0].role !== UserRole.SUPER_ADMIN) {
          return res.status(403).json({ 
            message: "Solo un SuperAdmin puede crear invitaciones para Dueños de empresa" 
          });
        }
      }

      // Calcular fecha de expiración (24 horas desde ahora)
      const expiresAt = add(new Date(), { hours: 24 });

      const [invitation] = await db
        .insert(invitations)
        .values({
          role,
          email: email || null,
          expiresAt,
          createdById: creatorId,
        })
        .returning();

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error al crear invitación:", error);
      res.status(500).json({ message: "Error al crear invitación" });
    }
  });

  // Endpoint para obtener todas las invitaciones
  app.get("/api/invitations", async (_req: Request, res: Response) => {
    try {
      const allInvitations = await db.select().from(invitations);
      res.json(allInvitations);
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
      const { firstName, lastName, email, password, companyName, companyLogo } = req.body;

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

      // Si es un dueño de empresa, verificamos si tenemos el nombre de la empresa
      if (invitation[0].role === UserRole.COMPANY_OWNER && !companyName) {
        return res.status(400).json({ message: "Nombre de la empresa es requerido para el rol de Dueño de empresa" });
      }

      // Si es un dueño de empresa, primero creamos la empresa
      let createdCompanyId: number | null = null;
      
      if (invitation[0].role === UserRole.COMPANY_OWNER && companyName) {
        try {
          // Intentar crear la empresa en la base de datos
          const [company] = await db
            .insert(companies)
            .values({
              name: companyName,
              logo: companyLogo || ""
            })
            .returning();
          
          if (company) {
            createdCompanyId = company.id;
            console.log(`Empresa creada con éxito: ${companyName}, ID: ${createdCompanyId}`);
          }
        } catch (error) {
          console.error("Error al crear la empresa:", error);
          return res.status(500).json({ message: "Error al crear la empresa" });
        }
      }

      // Crear el usuario
      const userData = {
        firstName,
        lastName,
        email,
        password: await hashPassword(password),
        role: invitation[0].role,
        company: invitation[0].role === UserRole.COMPANY_OWNER ? companyName : ""
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
      
      // Incluir información adicional en la respuesta
      const responseData = {
        ...userWithoutPassword,
        companyId: createdCompanyId
      };
      
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Error en registro:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
}