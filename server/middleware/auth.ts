import { Request, Response, NextFunction } from "express";

// Middleware para verificar que el usuario está autenticado
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "No autenticado" });
}

// Middleware para verificar si el usuario tiene un rol específico
export function hasRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const userRole = req.user?.role?.toLowerCase();
    
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: "No tienes permisos para acceder a este recurso" });
    }

    next();
  };
}