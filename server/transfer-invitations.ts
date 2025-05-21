import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";
import { isAuthenticated } from "./auth";
import { apiRouter } from "./routes";
import { DateTime } from "luxon";
import { eq, and } from "drizzle-orm";
import { companyInvitations, companyTransferAuthorizations } from "@shared/schema";

// Set up the routes for the transfer invitations
export function setupTransferInvitationRoutes(app: Express) {
  // Generar un enlace de invitación
  app.post(apiRouter('/transfers/generate-invitation'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      // Verificar que el usuario sea dueño
      if (!user || user.role !== 'dueño') {
        console.log(`[/transfers/generate-invitation] Error: Usuario ${user?.email} no tiene permiso (rol: ${user?.role})`);
        return res.status(403).json({
          error: "Permiso denegado",
          details: "Solo los dueños de la empresa pueden generar invitaciones de transferencia"
        });
      }
      
      // Generar un token único
      const token = uuidv4();
      
      // Obtener información de la empresa del usuario
      const company = await storage.getCompanyById(user.company);
      
      if (!company) {
        console.log(`[/transfers/generate-invitation] Error: No se encontró la empresa ${user.company}`);
        return res.status(404).json({
          error: "Empresa no encontrada",
          details: "No se pudo encontrar la empresa del usuario actual"
        });
      }
      
      // Configurar fechas
      const now = DateTime.now().toISO() || new Date().toISOString();
      const expiresAt = DateTime.now().plus({ days: 7 }).toISO() || 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Crear la invitación en la base de datos
      const invitation = {
        token,
        sourceCompanyId: company.identifier,
        sourceCompanyName: company.name,
        createdById: user.id,
        createdAt: new Date(now),
        expiresAt: new Date(expiresAt),
        isUsed: false
      };
      
      // Guardar la invitación en la base de datos
      await storage.db.insert(companyInvitations).values(invitation);
      
      console.log(`[/transfers/generate-invitation] Invitación generada: ${token} para empresa ${company.name}`);
      
      // Devolver el token
      res.json({ token });
    } catch (error) {
      console.error('[/transfers/generate-invitation] Error:', error);
      res.status(500).json({ 
        error: "Error interno", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Validar un enlace de invitación
  app.get(apiRouter('/transfers/validate-invitation/:token'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ 
          valid: false, 
          error: "Token no proporcionado" 
        });
      }
      
      // Buscar la invitación en la base de datos
      const invitation = await storage.db.query.companyInvitations.findFirst({
        where: eq(companyInvitations.token, token)
      });
      
      if (!invitation) {
        return res.status(404).json({ 
          valid: false, 
          error: "Invitación no encontrada" 
        });
      }
      
      // Verificar si ya ha sido usada
      if (invitation.isUsed) {
        return res.status(410).json({ 
          valid: false, 
          error: "Invitación ya utilizada" 
        });
      }
      
      // Verificar si ha expirado
      const expiryDate = DateTime.fromJSDate(invitation.expiresAt);
      if (expiryDate < DateTime.now()) {
        return res.status(410).json({ 
          valid: false, 
          error: "Invitación expirada" 
        });
      }
      
      // La invitación es válida
      console.log(`[/transfers/validate-invitation] Invitación ${token} validada correctamente`);
      
      // Obtener información de la empresa solicitante
      const company = await storage.getCompanyById(invitation.sourceCompanyId);
      
      res.json({
        valid: true,
        company: {
          name: company?.name || invitation.sourceCompanyName,
          identifier: invitation.sourceCompanyId
        }
      });
    } catch (error) {
      console.error('[/transfers/validate-invitation] Error:', error);
      res.status(500).json({ 
        valid: false,
        error: "Error interno", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Aceptar una invitación
  app.post(apiRouter('/transfers/accept-invitation/:token'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { user } = req as any;
      
      // Verificar que el usuario sea dueño
      if (!user || user.role !== 'dueño') {
        console.log(`[/transfers/accept-invitation] Error: Usuario ${user?.email} no tiene permiso (rol: ${user?.role})`);
        return res.status(403).json({
          error: "Permiso denegado",
          details: "Solo los dueños de la empresa pueden aceptar invitaciones de transferencia"
        });
      }
      
      // Buscar la invitación
      const invitation = await storage.db.query.companyInvitations.findFirst({
        where: eq(companyInvitations.token, token)
      });
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitación no encontrada" });
      }
      
      // Verificar si ya ha sido usada
      if (invitation.isUsed) {
        return res.status(410).json({ error: "Invitación ya utilizada" });
      }
      
      // Verificar si ha expirado
      const expiryDate = DateTime.fromJSDate(invitation.expiresAt);
      if (expiryDate < DateTime.now()) {
        return res.status(410).json({ error: "Invitación expirada" });
      }
      
      // Obtener la empresa del usuario
      const userCompany = await storage.getCompanyById(user.company);
      
      if (!userCompany) {
        console.log(`[/transfers/accept-invitation] Error: No se encontró la empresa ${user.company}`);
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      
      // Marcar la invitación como usada
      const now = new Date();
      
      await storage.db.update(companyInvitations)
        .set({
          isUsed: true,
          usedById: user.id,
          usedAt: now,
          targetCompanyId: userCompany.identifier
        })
        .where(eq(companyInvitations.token, token));
      
      // Añadir relación de autorización entre empresas
      await storage.db.insert(companyTransferAuthorizations).values({
        sourceCompanyId: invitation.sourceCompanyId,
        targetCompanyId: userCompany.identifier,
        createdAt: now,
        isActive: true
      });
      
      console.log(`[/transfers/accept-invitation] Invitación ${token} aceptada: ${invitation.sourceCompanyId} -> ${userCompany.identifier}`);
      
      // Crear notificación para el creador de la invitación
      await storage.createNotification({
        userId: invitation.createdById,
        type: 'company_authorization',
        title: 'Invitación Aceptada',
        message: `La empresa ${userCompany.name} ha aceptado tu invitación para transferir reservaciones.`,
        read: false
      });
      
      // Responder con éxito
      res.json({
        success: true,
        message: "Invitación aceptada correctamente"
      });
    } catch (error) {
      console.error('[/transfers/accept-invitation] Error:', error);
      res.status(500).json({ 
        error: "Error interno", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  // Obtener empresas autorizadas para transferencias
  app.get(apiRouter('/transfers/authorized-companies'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener las autorizaciones de transferencia para esta empresa
      const authorizations = await storage.db.query.companyTransferAuthorizations.findMany({
        where: and(
          eq(companyTransferAuthorizations.sourceCompanyId, user.company),
          eq(companyTransferAuthorizations.isActive, true)
        )
      });
      
      if (!authorizations || authorizations.length === 0) {
        return res.json([]);
      }
      
      // Obtener los detalles de las empresas autorizadas
      const companies = [];
      
      for (const auth of authorizations) {
        const company = await storage.getCompanyById(auth.targetCompanyId);
        if (company) {
          companies.push({
            id: company.id,
            name: company.name,
            identifier: company.identifier,
            logo: company.logo
          });
        }
      }
      
      console.log(`[/transfers/authorized-companies] Encontradas ${companies.length} empresas autorizadas para ${user.company}`);
      
      res.json(companies);
    } catch (error) {
      console.error('[/transfers/authorized-companies] Error:', error);
      res.status(500).json({ 
        error: "Error interno", 
        details: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });
}