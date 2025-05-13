import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { 
  users, insertUserSchema, insertInvitationSchema, invitations, UserRole,
  companies, insertCompanySchema, userCompanies
} from "@shared/schema";
import { eq, and, isNull, ne, or, inArray } from "drizzle-orm";
import { add } from "date-fns";
import { getAuthMiddleware } from "./auth-session";

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

export function setupAuthRoutes(app: Express, customIsAuthenticated?: any) {
  // Utilizar el middleware de autenticación importado o el proporcionado
  const authMiddleware = customIsAuthenticated || getAuthMiddleware();
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
  app.get("/api/users", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { user } = req as any; // Obtener el usuario autenticado desde la sesión
      const { role } = req.query; // Obtener el filtro de rol de la consulta (opcional)
      
      console.log(`[GET /api/users] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      if (role) {
        console.log(`[GET /api/users] Filtro de rol solicitado: ${role}`);
      }
      
      // El middleware isAuthenticated ya garantiza que el usuario está autenticado
      let query = db.select().from(users);
      
      // Aplicar filtro de rol si está presente en la consulta
      if (role) {
        // Si se solicita un rol específico, aplicar ese filtro
        query = query.where(eq(users.role, role as string));
      }
      
      // Filtrar ADEMÁS según el rol del usuario autenticado
      if (user.role === UserRole.OWNER) {
        // Los "Dueños" solo ven a los usuarios que ellos han invitado o de su compañía
        if (user.companyId) {
          // Filtrar por usuarios de la misma compañía
          query = query.where(eq(users.companyId, user.companyId));
        } else {
          // Si no tiene companyId, usar el filtro por invitados
          query = query.where(eq(users.invitedById, user.id));
        }
      } else if (user.role === UserRole.ADMIN) {
        // Los administradores solo deben ver a los usuarios de su misma compañía, excepto los superadmin
        const userCompany = user.companyId || user.company;
        console.log(`[GET /api/users] Admin: ${user.firstName} ${user.lastName}, filtrando por compañía: ${userCompany}`);
        
        if (userCompany) {
          query = query.where(
            and(
              ne(users.role, UserRole.SUPER_ADMIN),
              or(
                eq(users.companyId, userCompany),
                eq(users.company, userCompany)
              )
            )
          );
        } else {
          console.warn(`[GET /api/users] El administrador ${user.id} no tiene companyId o company definido`);
          query = query.where(ne(users.role, UserRole.SUPER_ADMIN));
        }
      } else if (user.role !== UserRole.SUPER_ADMIN) {
        // Otros roles solo se ven a sí mismos
        query = query.where(eq(users.id, user.id));
      }
      // Los superadmin ven a todos los usuarios (aunque se puede filtrar por rol)
      
      const filteredUsers = await query;
      console.log(`[GET /api/users] Encontrados ${filteredUsers.length} usuarios`);
      
      res.json(filteredUsers);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      res.status(500).json({ message: "Error al obtener usuarios" });
    }
  });
  
  // Endpoint para eliminar un usuario - SOLO SUPERADMIN
  app.delete("/api/users/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { user } = req as any; // Obtener el usuario autenticado
      const userId = parseInt(req.params.id);
      
      // Verificar que el usuario tenga permisos (solo superadmin)
      if (user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ 
          message: "No tienes permisos para eliminar usuarios"
        });
      }
      
      // Verificar que no se esté eliminando a sí mismo
      if (user.id === userId) {
        return res.status(400).json({ 
          message: "No puedes eliminar tu propia cuenta" 
        });
      }
      
      // Verificar que el usuario a eliminar exista
      const userToDelete = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
        
      if (userToDelete.length === 0) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      
      try {
        // Primero, verificar si el usuario tiene asociaciones en user_companies
        if (userToDelete[0].role === UserRole.TICKET_OFFICE) {
          console.log(`Eliminando asociaciones de empresas para el usuario taquillero ${userId}`);
          // Eliminar todas las asociaciones de empresas del usuario
          await db
            .delete(userCompanies)
            .where(eq(userCompanies.userId, userId));
          console.log(`Asociaciones de empresas eliminadas para el usuario ${userId}`);
        }
        
        // Ahora eliminar el usuario
        await db
          .delete(users)
          .where(eq(users.id, userId));
        
        console.log(`Usuario ${userId} eliminado por ${user.email} (${user.role})`);
      } catch (error) {
        console.error("Error al eliminar usuario:", error);
        return res.status(500).json({ message: "Error al eliminar usuario" });
      }
      
      res.status(200).json({ 
        message: "Usuario eliminado correctamente"
      });
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      res.status(500).json({ 
        message: "Error al eliminar usuario"
      });
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
  app.post("/api/invitations", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { role, email, selectedCompanies } = req.body;
      const { user } = req as any; // Obtener el usuario autenticado

      if (!role) {
        return res.status(400).json({ message: "El rol es requerido" });
      }

      // El middleware isAuthenticated ya garantiza que el usuario está autenticado

      // Verificar que solo superAdmin puede crear usuarios de taquilla
      if (role === UserRole.TICKET_OFFICE && user.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({
          message: "Solo el Super Administrador puede crear usuarios de taquilla"
        });
      }

      // Validar que la selección de empresas es obligatoria para taquilla
      if (role === UserRole.TICKET_OFFICE && (!selectedCompanies || !Array.isArray(selectedCompanies) || selectedCompanies.length === 0)) {
        return res.status(400).json({
          message: "Debe seleccionar al menos una empresa para usuarios de taquilla"
        });
      }
      
      // Nueva lógica para DUEÑO - puede invitar roles específicos, incluyendo Administrador y Comisionista
      if (user.role === UserRole.OWNER) {
        const rolesPermitidos = [
          UserRole.OWNER,
          UserRole.ADMIN,
          UserRole.CALL_CENTER, 
          UserRole.CHECKER, 
          UserRole.DRIVER,
          UserRole.COMMISSIONER
        ];
        
        if (!rolesPermitidos.includes(role)) {
          return res.status(403).json({ 
            message: "Como Dueño, solo puede invitar a usuarios con roles: Dueño, Administrador, Call Center, Checador, Chofer o Comisionista" 
          });
        }
      } 
      // Mantener restricciones para Admin
      else if (user.role === UserRole.ADMIN && 
          (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN || role === UserRole.OWNER)) {
        return res.status(403).json({ 
          message: "No tiene permisos para crear este tipo de usuario" 
        });
      }
      // Otros roles no pueden crear usuarios
      else if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
        return res.status(403).json({ 
          message: "Su rol no tiene permiso para crear usuarios" 
        });
      }

      // Calcular fecha de expiración (24 horas desde ahora)
      const expiresAt = add(new Date(), { hours: 24 });

      // Crear la invitación
      // IMPORTANTE: No convertimos a JSON aquí ya que Drizzle lo hace automáticamente
      const metadataValue = role === UserRole.TICKET_OFFICE && selectedCompanies ? 
        { selectedCompanies } : null;

      const [invitation] = await db
        .insert(invitations)
        .values({
          role,
          email: email || null,
          expiresAt,
          createdById: user.id, // Usar el ID del usuario autenticado como creador
          metadata: metadataValue, // Guardar las empresas seleccionadas como metadatos
        })
        .returning();
        
      if (role === UserRole.TICKET_OFFICE && selectedCompanies && selectedCompanies.length > 0) {
        console.log(`[POST /api/invitations] Creando invitación para taquilla con empresas: ${JSON.stringify(selectedCompanies)}`);
      }

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error al crear invitación:", error);
      res.status(500).json({ message: "Error al crear invitación" });
    }
  });

  // Endpoint para obtener invitaciones filtradas por rol
  app.get("/api/invitations", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { user } = req as any; // Obtener el usuario autenticado desde la sesión
      
      // El middleware isAuthenticated ya garantiza que el usuario está autenticado
      let query = db.select().from(invitations);
      
      // Filtrar según el rol del usuario autenticado
      if (user.role === UserRole.OWNER) {
        // Los "Dueños" solo ven las invitaciones que ellos han creado
        query = query.where(eq(invitations.createdById, user.id));
      } else if (user.role === UserRole.ADMIN) {
        // Los administradores solo deben ver invitaciones de su misma compañía
        const userCompany = user.companyId || user.company;
        console.log(`[GET /api/invitations] Admin: ${user.firstName} ${user.lastName}, filtrando por compañía`);
        
        if (userCompany) {
          // Buscar los IDs de los usuarios de la misma compañía
          const usersFromSameCompany = await db
            .select()
            .from(users)
            .where(
              or(
                eq(users.companyId, userCompany),
                eq(users.company, userCompany)
              )
            );
          
          const userIds = usersFromSameCompany.map(u => u.id);
          console.log(`[GET /api/invitations] Filtrando por ${userIds.length} usuarios de la misma compañía`);
          
          // Filtrar invitaciones creadas por usuarios de la misma compañía
          if (userIds.length > 0) {
            query = query.where(inArray(invitations.createdById, userIds));
          }
        }
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

      // Obtener información del usuario que invita
      const inviter = await db
        .select()
        .from(users)
        .where(eq(users.id, invitation[0].createdById))
        .limit(1);

      // Información del invitante para mostrar en el formulario de registro
      let inviterInfo = null;
      if (inviter.length > 0) {
        inviterInfo = {
          firstName: inviter[0].firstName,
          lastName: inviter[0].lastName,
          company: inviter[0].company,
          profilePicture: inviter[0].profilePicture,
          role: inviter[0].role
        };
      }
      
      // Procesar metadatos si existen (para usuarios de taquilla)
      let selectedCompanies = null;
      if (invitation[0].metadata && invitation[0].role === UserRole.TICKET_OFFICE) {
        try {
          const metadata = JSON.parse(invitation[0].metadata as string);
          if (metadata.selectedCompanies) {
            selectedCompanies = metadata.selectedCompanies;
          }
        } catch (parseErr) {
          console.error("Error al parsear metadatos de invitación:", parseErr);
        }
      }

      res.json({
        valid: true,
        role: invitation[0].role,
        email: invitation[0].email,
        inviter: inviterInfo,
        selectedCompanies: selectedCompanies
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
      const { 
        firstName, lastName, email, password, company, profilePicture, 
        companyData  // Nuevo campo para los datos de la compañía
      } = req.body;

      console.log("[REGISTER] Solicitud de registro recibida:", {
        firstName, lastName, email, company,
        role: req.body.role,
        hasCompanyData: !!companyData,
        companyDataFields: companyData ? Object.keys(companyData) : []
      });

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
      if (invitation[0].role === UserRole.OWNER) {
        // Para usuarios Dueño, verificar si tenemos los datos de la empresa
        if (!company && (!companyData || !companyData.name)) {
          return res.status(400).json({ 
            message: "El nombre de la empresa es obligatorio para usuarios con rol Dueño" 
          });
        }
      } else if (invitation[0].role === UserRole.DEVELOPER && !company) {
        return res.status(400).json({ 
          message: "El nombre de la empresa/proyecto es obligatorio para usuarios con rol Desarrollador" 
        });
      }

      // Obtener el usuario invitador
      const inviter = await db
        .select()
        .from(users)
        .where(eq(users.id, invitation[0].createdById))
        .limit(1);
        
      // Si el invitador es un dueño, se usa su foto de perfil y compañía para los invitados
      let companyId = "";
      let companyName = "";
      let profilePictureToUse = profilePicture || "";
      let companyToUse = company || ""; // Variable para guardar el nombre de la empresa a utilizar
      
      // El companyId se hereda del invitador tanto si es Owner o Admin
      if (inviter.length > 0) {
        // Para todos los roles, tomar el companyId del invitador
        companyId = inviter[0].companyId || inviter[0].company; // Usar companyId si existe, si no, usar el valor de company
        companyName = inviter[0].company || ""; // Guardar el nombre de la empresa explícitamente
        
        console.log(`[REGISTER] Invitador role: ${inviter[0].role}, companyId: ${companyId}`);
        
        // Si el usuario que se está registrando NO es un dueño o superadmin
        if (invitation[0].role !== UserRole.OWNER && invitation[0].role !== UserRole.SUPER_ADMIN) {
          // Heredar la foto de perfil del invitador
          profilePictureToUse = inviter[0].profilePicture || "";
          
          // Para todos los roles excepto dueño y superadmin, heredan la empresa del invitador
          companyToUse = companyName;
          console.log(`[REGISTER] Asignando companyId ${companyId} y empresa ${companyName} al nuevo usuario con rol ${invitation[0].role}`);
        }
      }
      
      // Crear el usuario con campos adicionales según el rol
      const userData = {
        firstName,
        lastName,
        email,
        password: await hashPassword(password),
        role: invitation[0].role,
        company: (invitation[0].role === UserRole.OWNER || invitation[0].role === UserRole.DEVELOPER) ? 
          (companyData?.name || company) : companyToUse,
        profilePicture: profilePictureToUse,
        invitedById: invitation[0].createdById, // Guardar referencia al usuario que invitó
        companyId: companyId, // Guardar referencia a la compañía (se actualizará después si es OWNER)
      };

      // Insertar el usuario
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();

      // Si es un dueño y tenemos datos de compañía, crear la compañía
      if (invitation[0].role === UserRole.OWNER && companyData) {
        try {
          // Generar un identificador único para la compañía
          const companyIdentifier = `${companyData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-6)}`;
          
          console.log(`[REGISTER] Creando compañía con identificador: ${companyIdentifier}`);
          
          // Insertar la compañía en la tabla companies
          const [newCompany] = await db
            .insert(companies)
            .values({
              name: companyData.name,
              identifier: companyIdentifier,
              logo: companyData.logo || '',
              createdBy: user.id // El usuario recién creado es el creador de la compañía
            })
            .returning();
          
          console.log(`[REGISTER] Compañía creada con ID: ${newCompany.id}, Identifier: ${newCompany.identifier}`);
          
          // Actualizar el usuario con el identificador de la compañía
          await db
            .update(users)
            .set({ 
              companyId: newCompany.identifier,
              company: newCompany.name
            })
            .where(eq(users.id, user.id));
          
          // Actualizar el objeto de usuario para la respuesta
          user.companyId = newCompany.identifier;
          user.company = newCompany.name;
          
          console.log(`[REGISTER] Usuario actualizado con companyId: ${newCompany.identifier}`);
        } catch (companyError) {
          console.error("[REGISTER] Error al crear la compañía:", companyError);
          // No fallar el registro si falla la creación de la compañía
        }
      }

      // Si es taquilla, verificar si hay empresas seleccionadas en los metadatos
      if (invitation[0].role === UserRole.TICKET_OFFICE && invitation[0].metadata) {
        try {
          // Manejar diferentes formatos de metadata (puede ser objeto o string)
          let metadata;
          if (typeof invitation[0].metadata === 'string') {
            // Intenta parsear como JSON regular
            try {
              metadata = JSON.parse(invitation[0].metadata);
            } catch (e) {
              // Si falla el parse regular, intenta con formato de escape adicional
              // (esto es para manejar los registros existentes con doble escape)
              const cleanedJson = (invitation[0].metadata as string)
                .replace(/^\"/, '') // Quitar comillas al inicio
                .replace(/\"$/, '') // Quitar comillas al final
                .replace(/\\"/g, '"'); // Reemplazar \" por "
              
              metadata = JSON.parse(cleanedJson);
            }
          } else {
            // Ya es un objeto
            metadata = invitation[0].metadata;
          }
          
          // Verificar si hay compañías seleccionadas
          if (metadata.selectedCompanies && Array.isArray(metadata.selectedCompanies) && metadata.selectedCompanies.length > 0) {
            console.log(`[REGISTER] Usuario taquilla: Asociando con ${metadata.selectedCompanies.length} empresas: ${JSON.stringify(metadata.selectedCompanies)}`);
            
            // Crear asociaciones entre el usuario y cada empresa seleccionada
            for (const companyIdentifier of metadata.selectedCompanies) {
              await db
                .insert(userCompanies)
                .values({
                  userId: user.id,
                  companyId: companyIdentifier
                });
              console.log(`[REGISTER] Asociado usuario ${user.id} con empresa ${companyIdentifier}`);
            }
          } else {
            console.log(`[REGISTER] No se encontraron compañías seleccionadas en los metadatos:`, metadata);
          }
        } catch (parseErr) {
          console.error("Error al procesar metadatos de invitación:", parseErr);
          console.error("Valor de metadata:", invitation[0].metadata);
        }
      }

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
  
  // Endpoint para obtener todas las empresas (usado por el modal de selección)
  app.get("/api/companies", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[GET /api/companies] Solicitud recibida desde usuario: ${user.firstName} ${user.lastName}, rol: ${user.role}`);
      
      // Solo superAdmin puede ver todas las empresas para asignarlas
      if (user.role !== UserRole.SUPER_ADMIN) {
        console.log(`[GET /api/companies] Acceso denegado para usuario con rol ${user.role}`);
        return res.status(403).json({ message: "Acceso denegado" });
      }
      
      // Obtener todas las empresas
      const allCompanies = await db
        .select()
        .from(companies);
      
      console.log(`[GET /api/companies] Encontradas ${allCompanies.length} empresas`);
      for (const company of allCompanies) {
        console.log(`[GET /api/companies] Empresa: ${company.name}, ID: ${company.identifier}`);
      }
      
      res.json(allCompanies);
    } catch (error) {
      console.error("Error al obtener empresas:", error);
      res.status(500).json({ message: "Error al obtener empresas" });
    }
  });
  
  // Endpoint para obtener las empresas asociadas a un usuario de taquilla
  app.get("/api/user/companies", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      // Si el usuario no es de taquilla, simplemente devolver un arreglo vacío
      if (user.role !== UserRole.TICKET_OFFICE) {
        return res.json([]);
      }
      
      // Obtener las asociaciones del usuario con empresas
      const userCompanyAssociations = await db
        .select()
        .from(userCompanies)
        .where(eq(userCompanies.userId, user.id));
      
      if (userCompanyAssociations.length === 0) {
        return res.json([]);
      }
      
      // Obtener los IDs de las empresas
      const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
      
      // Obtener los detalles de las empresas
      const companiesData = await db
        .select()
        .from(companies)
        .where(inArray(companies.identifier, companyIds));
      
      // Log para depuración
      console.log(`[GET /api/user/companies] Usuario taquilla ${user.id}: ${companiesData.length} empresas asociadas`);
      console.log(`[GET /api/user/companies] IDs de empresas: ${companyIds.join(', ')}`);
      
      res.json(companiesData);
    } catch (error) {
      console.error("Error al obtener empresas del usuario:", error);
      res.status(500).json({ message: "Error al obtener empresas del usuario" });
    }
  });
}