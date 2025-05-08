import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para verificar si un usuario está autenticado
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ message: "No autenticado" });
}