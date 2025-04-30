import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';

/**
 * Middleware para verificar si el usuario está autenticado
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'No autenticado' });
};

/**
 * Middleware para verificar si el usuario tiene un rol específico
 * @param allowedRoles Array de roles permitidos
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Primero verificar si el usuario está autenticado
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    // Obtener el usuario de la sesión
    const user = req.user as any;
    
    // Verificar si el rol del usuario está en la lista de roles permitidos
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        message: 'No autorizado',
        requiredRoles: allowedRoles,
        userRole: user?.role || 'no role'
      });
    }
    
    // Si todo está bien, continuar
    next();
  };
};

/**
 * Middleware para verificar si el usuario es un administrador
 */
export const requireAdmin = requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Middleware para verificar si el usuario es un superadministrador
 */
export const requireSuperAdmin = requireRole([UserRole.SUPER_ADMIN]);