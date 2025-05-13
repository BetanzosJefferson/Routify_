import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import bcrypt from "bcryptjs";

// Middleware exportado para verificar autenticación
export const getAuthMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "No autenticado" });
  };
};

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      company: string | null;
      profilePicture: string | null;
    }
  }
}

async function comparePasswords(supplied: string, stored: string) {
  // Verificar si la contraseña está en formato bcrypt
  if (stored.startsWith('$2')) {
    // Usar bcrypt para comparar
    return bcrypt.compare(supplied, stored);
  } else if (stored.includes('.')) {
    // Usar el formato antiguo con scrypt si contiene un punto
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } else {
    // Formato desconocido, rechazar
    console.error("Formato de contraseña no soportado:", stored.substring(0, 5) + "...");
    return false;
  }
}

// Función para configurar la autenticación
export function setupAuthentication(app: Express) {
  // Definir opciones de sesión
  const sessionSecret = process.env.SESSION_SECRET || "transroute-secret-key-change-in-production";
  
  // Configurar el almacén de sesiones
  const MemoryStore = createMemoryStore(session);
  const PostgresStore = connectPg(session);
  
  // Usar PostgreSQL para sesiones en producción, memoria en desarrollo
  const sessionStore = process.env.NODE_ENV === "production"
    ? new PostgresStore({
        pool,
        tableName: "session", // Nombre de la tabla para sesiones
        createTableIfMissing: true,
      })
    : new MemoryStore({
        checkPeriod: 86400000, // Limpiar cada 24 horas
      });

  // Configurar express-session
  app.use(
    session({
      store: sessionStore,
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Solo HTTPS en producción
        sameSite: "lax",
      },
    })
  );

  // Inicializar Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configurar la estrategia local de Passport
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          // Buscar el usuario por email
          const userResults = await db
            .select()
            .from(users)
            .where(eq(users.email, email));

          if (userResults.length === 0) {
            return done(null, false, { message: "Credenciales inválidas" });
          }

          const user = userResults[0];
          
          // Verificar la contraseña
          const isPasswordValid = await comparePasswords(password, user.password);
          if (!isPasswordValid) {
            return done(null, false, { message: "Credenciales inválidas" });
          }

          // Eliminar la contraseña del objeto usuario
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serializar usuario para almacenar en la sesión
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserializar usuario de la sesión
  passport.deserializeUser(async (id: number, done) => {
    try {
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.id, id));

      if (userResults.length === 0) {
        return done(null, false);
      }

      const user = userResults[0];
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (error) {
      done(error);
    }
  });

  // Middleware para verificar autenticación
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "No autenticado" });
  };

  // Middleware para verificar rol
  const hasRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const userRole = req.user?.role;
      if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({ message: "No autorizado para esta acción" });
      }

      next();
    };
  };

  // Rutas de autenticación
  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "Credenciales inválidas" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.json({ message: "Sesión cerrada exitosamente" });
    });
  });

  // Obtener usuario actual
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    res.json(req.user);
  });

  // Actualizar foto de perfil
  app.post("/api/auth/update-profile-picture", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const { profilePicture } = req.body;
      
      if (!userId || !profilePicture) {
        return res.status(400).json({ message: "Se requiere un usuario autenticado y una imagen de perfil" });
      }
      
      // Actualizar la foto de perfil en la base de datos
      const [updatedUser] = await db
        .update(users)
        .set({ profilePicture })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      // Actualizar el usuario en la sesión
      const { password: _, ...userWithoutPassword } = updatedUser;
      req.login(userWithoutPassword, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error al actualizar la sesión" });
        }
        return res.json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error al actualizar la foto de perfil:", error);
      res.status(500).json({ message: "Error al actualizar la foto de perfil" });
    }
  });

  return { isAuthenticated, hasRole };
}