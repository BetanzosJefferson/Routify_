import { Request, Response, NextFunction } from 'express';
import { UserRole, UserRoleType } from '@shared/schema';

/**
 * Middleware para verificar si el usuario tiene alguno de los roles especificados
 * @param roles Arreglo de roles permitidos
 */
export const requireRole = (roles: UserRoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Verificar si el usuario está autenticado
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    const userRole = (req.user as any).role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Acceso denegado',
        message: 'No tiene permiso para acceder a este recurso'
      });
    }

    next();
  };
};