import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, insertUserSchema, insertInvitationSchema, invitations, UserRole } from "@shared/schema";
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
      const { role, email } = req.body;

      if (!role) {
        return res.status(400).json({ message: "El rol es requerido" });
      }

      // Normalmente verificaríamos que el usuario está autenticado y tiene permisos
      // Por ahora, asumimos que el creador es el primer SuperAdmin
      const admin = await db
        .select()
        .from(users)
        .where(eq(users.role, UserRole.SUPER_ADMIN))
        .limit(1);

      if (admin.length === 0) {
        return res.status(500).json({ message: "No se encontró un administrador para crear la invitación" });
      }

      // Calcular fecha de expiración (24 horas desde ahora)
      const expiresAt = add(new Date(), { hours: 24 });

      const [invitation] = await db
        .insert(invitations)
        .values({
          role,
          email: email || null,
          expiresAt,
          createdById: admin[0].id,
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
      const { firstName, lastName, email, password } = req.body;

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

      // Crear el usuario
      const [user] = await db
        .insert(users)
        .values({
          firstName,
          lastName,
          email,
          password: await hashPassword(password),
          role: invitation[0].role,
        })
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