import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';

/**
 * Middleware para verificar si un usuario está autenticado
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "No autenticado" });
};

/**
 * Middleware para verificar si un usuario tiene uno de los roles especificados
 * @param roles - Lista de roles permitidos
 */
export const hasRole = (roles: string[]) => {
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