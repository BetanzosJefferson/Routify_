import { Router } from "express";
import { CouponService } from "../services/coupon-service";
import { insertCouponSchema, UserRole } from "@shared/schema";
import { isAuthenticated, requireRole } from "../middleware/auth";

const router = Router();

// Middleware para verificar si el usuario tiene rol de dueño o superadmin (únicos que pueden gestionar cupones)
const requireOwnerOrSuperAdmin = requireRole([UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.DEVELOPER]);

// Obtener todos los cupones (filtrados por compañía si corresponde)
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { user } = req as any;
    let companyId: string | undefined;
    
    // Solo superadmin puede ver TODOS los cupones
    // El resto solo ve los cupones de su compañía
    if (user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
      companyId = user.companyId || user.company;
      
      if (!companyId) {
        return res.status(403).json({ error: "No tiene permiso para ver cupones" });
      }
    }
    
    const coupons = await CouponService.getCoupons(companyId);
    res.json(coupons);
  } catch (error: any) {
    console.error("Error al obtener cupones:", error);
    res.status(500).json({ error: "Error al obtener cupones", details: error.message || "Error desconocido" });
  }
});

// Obtener un cupón por su ID
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user } = req as any;
    
    const coupon = await CouponService.getCouponById(id);
    
    if (!coupon) {
      return res.status(404).json({ error: "Cupón no encontrado" });
    }
    
    // Verificar acceso por compañía (excepto superadmin)
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
      const companyId = user.companyId || user.company;
      
      if (!companyId || (coupon.companyId && coupon.companyId !== companyId)) {
        return res.status(403).json({ error: "No tiene permiso para ver este cupón" });
      }
    }
    
    res.json(coupon);
  } catch (error: any) {
    console.error("Error al obtener cupón:", error);
    res.status(500).json({ error: "Error al obtener cupón", details: error.message || "Error desconocido" });
  }
});

// Obtener un cupón por su código
router.get("/code/:code", isAuthenticated, async (req, res) => {
  try {
    const code = req.params.code;
    const { user } = req as any;
    
    const coupon = await CouponService.getCouponByCode(code);
    
    if (!coupon) {
      return res.status(404).json({ error: "Cupón no encontrado" });
    }
    
    // Verificar acceso por compañía (excepto superadmin)
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
      const companyId = user.companyId || user.company;
      
      if (!companyId || (coupon.companyId && coupon.companyId !== companyId)) {
        return res.status(403).json({ error: "No tiene permiso para ver este cupón" });
      }
    }
    
    res.json(coupon);
  } catch (error: any) {
    console.error("Error al obtener cupón por código:", error);
    res.status(500).json({ error: "Error al obtener cupón por código", details: error.message || "Error desconocido" });
  }
});

// Crear un nuevo cupón (solo Owner o SuperAdmin)
router.post("/", isAuthenticated, requireOwnerOrSuperAdmin, async (req, res) => {
  try {
    const { user } = req as any;
    const validationResult = insertCouponSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Datos de cupón inválidos", 
        details: validationResult.error.format() 
      });
    }
    
    const couponData = validationResult.data;
    
    // Asignar compañía del usuario al cupón si no se proporciona una
    if (!couponData.companyId) {
      couponData.companyId = user.companyId || user.company;
      
      // Si es superadmin y no se proporcionó compañía, asignar una por defecto
      if (!couponData.companyId && user.role === UserRole.SUPER_ADMIN) {
        couponData.companyId = "viaja-facil-123";
      }
      
      if (!couponData.companyId) {
        return res.status(400).json({ error: "No se pudo determinar la compañía para el cupón" });
      }
    }
    
    const coupon = await CouponService.createCoupon(couponData);
    res.status(201).json(coupon);
  } catch (error: any) {
    console.error("Error al crear cupón:", error);
    res.status(500).json({ error: "Error al crear cupón", details: error.message || "Error desconocido" });
  }
});

// Actualizar un cupón (solo Owner o SuperAdmin)
router.put("/:id", isAuthenticated, requireOwnerOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user } = req as any;
    
    // Primero verificar que el cupón existe y pertenece a la compañía del usuario
    const existingCoupon = await CouponService.getCouponById(id);
    
    if (!existingCoupon) {
      return res.status(404).json({ error: "Cupón no encontrado" });
    }
    
    // Verificar acceso por compañía (excepto superadmin)
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
      const companyId = user.companyId || user.company;
      
      if (!companyId || (existingCoupon.companyId && existingCoupon.companyId !== companyId)) {
        return res.status(403).json({ error: "No tiene permiso para modificar este cupón" });
      }
    }
    
    const validationResult = insertCouponSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Datos de cupón inválidos", 
        details: validationResult.error.format() 
      });
    }
    
    const couponData = validationResult.data;
    const updatedCoupon = await CouponService.updateCoupon(id, couponData);
    
    res.json(updatedCoupon);
  } catch (error: any) {
    console.error("Error al actualizar cupón:", error);
    res.status(500).json({ error: "Error al actualizar cupón", details: error.message || "Error desconocido" });
  }
});

// Eliminar un cupón (solo Owner o SuperAdmin)
router.delete("/:id", isAuthenticated, requireOwnerOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { user } = req as any;
    
    // Primero verificar que el cupón existe y pertenece a la compañía del usuario
    const existingCoupon = await CouponService.getCouponById(id);
    
    if (!existingCoupon) {
      return res.status(404).json({ error: "Cupón no encontrado" });
    }
    
    // Verificar acceso por compañía (excepto superadmin)
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
      const companyId = user.companyId || user.company;
      
      if (!companyId || (existingCoupon.companyId && existingCoupon.companyId !== companyId)) {
        return res.status(403).json({ error: "No tiene permiso para eliminar este cupón" });
      }
    }
    
    const success = await CouponService.deleteCoupon(id);
    
    if (success) {
      res.status(204).end();
    } else {
      res.status(500).json({ error: "No se pudo eliminar el cupón" });
    }
  } catch (error: any) {
    console.error("Error al eliminar cupón:", error);
    res.status(500).json({ error: "Error al eliminar cupón", details: error.message || "Error desconocido" });
  }
});

// Validar un cupón
router.post("/validate", async (req, res) => {
  try {
    const { code, companyId } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Código de cupón requerido" });
    }
    
    const coupon = await CouponService.validateCoupon(code, companyId);
    
    if (!coupon) {
      return res.status(404).json({ error: "Cupón no válido o expirado" });
    }
    
    res.json(coupon);
  } catch (error: any) {
    console.error("Error al validar cupón:", error);
    res.status(500).json({ error: "Error al validar cupón", details: error.message || "Error desconocido" });
  }
});

// Aplicar un cupón a un monto
router.post("/apply", async (req, res) => {
  try {
    const { code, amount, companyId } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: "Código de cupón requerido" });
    }
    
    if (amount === undefined || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Monto inválido" });
    }
    
    const result = await CouponService.applyCoupon(code, amount, companyId);
    
    if (!result) {
      return res.status(404).json({ error: "Cupón no válido o expirado" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error al aplicar cupón:", error);
    res.status(500).json({ error: "Error al aplicar cupón", details: error.message || "Error desconocido" });
  }
});

export default router;