import { Request, Response, Router } from 'express';
import { UserRole } from '@shared/schema';
import { CouponService } from '../services/coupon-service';
import { requireRole } from '../middleware/auth';

const router = Router();

/**
 * Middleware para verificar si el usuario es "Dueño" de la compañía
 */
const requireOwnerRole = requireRole([UserRole.OWNER, UserRole.SUPER_ADMIN]);

/**
 * GET /api/coupons
 * Obtiene todos los cupones de la compañía del usuario
 */
router.get('/', requireOwnerRole, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.user as any;

    // Verificar que el usuario tenga una compañía asignada
    if (!companyId) {
      return res.status(400).json({ 
        error: 'El usuario no tiene una compañía asignada'
      });
    }

    const coupons = await CouponService.getCouponsByCompany(companyId);
    res.json(coupons);
  } catch (error) {
    console.error('[GET /coupons] Error:', error);
    res.status(500).json({ 
      error: 'Error al obtener los cupones'
    });
  }
});

/**
 * POST /api/coupons
 * Crea un nuevo cupón
 */
router.post('/', requireOwnerRole, async (req: Request, res: Response) => {
  try {
    const { companyId, id: userId } = req.user as any;
    
    // Verificar que el usuario tenga una compañía asignada
    if (!companyId) {
      return res.status(400).json({ 
        error: 'El usuario no tiene una compañía asignada'
      });
    }
    
    const { code, discountType, discountValue, duration, isRandomCode } = req.body;
    
    // Si se solicita un código aleatorio, generarlo
    let couponCode = code;
    if (isRandomCode) {
      let attempts = 0;
      let uniqueCodeFound = false;
      
      // Intentar generar un código único (max 5 intentos)
      while (!uniqueCodeFound && attempts < 5) {
        couponCode = CouponService.generateRandomCode();
        uniqueCodeFound = !(await CouponService.codeExists(couponCode));
        attempts++;
      }
      
      if (!uniqueCodeFound) {
        return res.status(400).json({ 
          error: 'No se pudo generar un código único. Intente más tarde.'
        });
      }
    } else {
      // Verificar si el código personalizado ya existe
      const codeExists = await CouponService.codeExists(couponCode);
      if (codeExists) {
        return res.status(400).json({ 
          error: 'El código ingresado ya existe'
        });
      }
    }
    
    // Crear el cupón
    const coupon = await CouponService.createCoupon({
      code: couponCode,
      discountType,
      discountValue,
      duration,
      companyId,
      createdById: userId,
      isActive: true
    });
    
    res.status(201).json(coupon);
  } catch (error) {
    console.error('[POST /coupons] Error:', error);
    res.status(500).json({ 
      error: 'Error al crear el cupón'
    });
  }
});

/**
 * POST /api/coupons/validate
 * Valida un código de cupón y retorna la información del descuento aplicado al monto total
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { code, totalAmount } = req.body;
    const { companyId } = req.user as any || req.body;
    
    if (!companyId) {
      return res.status(400).json({ 
        error: 'Se requiere la compañía para validar el cupón'
      });
    }
    
    if (!totalAmount || isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        error: 'Se requiere un monto total válido para calcular el descuento'
      });
    }
    
    const validationResult = await CouponService.validateCouponForReservation(
      code, 
      companyId,
      parseFloat(totalAmount)
    );
    
    if (!validationResult) {
      return res.status(404).json({ 
        error: 'Cupón no encontrado o expirado'
      });
    }
    
    // Retornar el cupón y el descuento calculado
    res.json(validationResult);
  } catch (error) {
    console.error('[POST /coupons/validate] Error:', error);
    res.status(500).json({ 
      error: 'Error al validar el cupón'
    });
  }
});

/**
 * PUT /api/coupons/:id/deactivate
 * Desactiva un cupón
 */
router.put('/:id/deactivate', requireOwnerRole, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { companyId } = req.user as any;
    
    // Verificar que el usuario tenga una compañía asignada
    if (!companyId) {
      return res.status(400).json({ 
        error: 'El usuario no tiene una compañía asignada'
      });
    }
    
    const coupon = await CouponService.deactivateCoupon(parseInt(id));
    
    if (!coupon) {
      return res.status(404).json({ 
        error: 'Cupón no encontrado'
      });
    }
    
    res.json(coupon);
  } catch (error) {
    console.error('[PUT /coupons/:id/deactivate] Error:', error);
    res.status(500).json({ 
      error: 'Error al desactivar el cupón'
    });
  }
});

export default router;