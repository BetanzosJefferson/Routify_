import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { 
  CouponDuration, 
  DiscountType, 
  InsertCoupon, 
  Coupon, 
  coupons 
} from '@shared/schema';

/**
 * Servicio para gestionar cupones de descuento
 */
export const CouponService = {
  /**
   * Crea un nuevo cupón
   */
  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    // Establecer la fecha de expiración basada en la duración seleccionada
    const expiresAt = data.duration ? calculateExpirationDate(data.duration) : null;
    
    // Crear el cupón con la fecha de expiración calculada
    const [coupon] = await db.insert(coupons)
      .values({
        ...data,
        expiresAt
      })
      .returning();
    
    return coupon;
  },
  
  /**
   * Obtiene un cupón por su código
   */
  async getCouponByCode(code: string, companyId: string): Promise<Coupon | undefined> {
    if (!code || !companyId) {
      return undefined;
    }
    
    const [coupon] = await db.select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, code),
          eq(coupons.companyId, companyId),
          eq(coupons.isActive, true),
          sql`${coupons.expiresAt} IS NULL OR ${coupons.expiresAt} > NOW()`
        )
      );
    
    return coupon;
  },
  
  /**
   * Obtiene todos los cupones de una compañía
   */
  async getCouponsByCompany(companyId: string): Promise<Coupon[]> {
    return db.select()
      .from(coupons)
      .where(eq(coupons.companyId, companyId))
      .orderBy(sql`${coupons.createdAt} DESC`);
  },
  
  /**
   * Incrementa el contador de uso de un cupón
   */
  async incrementUsageCount(couponId: number): Promise<void> {
    await db.update(coupons)
      .set({ 
        usedCount: sql`${coupons.usedCount} + 1` 
      })
      .where(eq(coupons.id, couponId));
  },
  
  /**
   * Desactiva un cupón
   */
  async deactivateCoupon(couponId: number): Promise<Coupon> {
    const [updatedCoupon] = await db.update(coupons)
      .set({ isActive: false })
      .where(eq(coupons.id, couponId))
      .returning();
    
    return updatedCoupon;
  },
  
  /**
   * Calcula el descuento a aplicar basado en el tipo de descuento y valor
   */
  calculateDiscount(totalAmount: number, discountType: typeof DiscountType[keyof typeof DiscountType], discountValue: number): number {
    if (discountType === DiscountType.PERCENTAGE) {
      // Descuento porcentual (hasta máximo 100%)
      const percentage = Math.min(discountValue, 100) / 100;
      return totalAmount * percentage;
    } else {
      // Descuento fijo (no puede ser mayor que el total)
      return Math.min(discountValue, totalAmount);
    }
  },
  
  /**
   * Genera un código aleatorio para un cupón
   */
  generateRandomCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 5;
    let code = '';
    
    for (let i = 0; i < codeLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters.charAt(randomIndex);
    }
    
    return code;
  },
  
  /**
   * Verifica si un código de cupón ya existe
   */
  async codeExists(code: string): Promise<boolean> {
    const result = await db.select({ count: count() })
      .from(coupons)
      .where(eq(coupons.code, code));
    
    return result[0].count > 0;
  }
};

/**
 * Calcula la fecha de expiración basada en la duración
 */
function calculateExpirationDate(duration: string | undefined): Date | null {
  // Si no hay duración o es permanente, no tiene fecha de expiración
  if (!duration || duration === CouponDuration.PERMANENT) {
    return null;
  }
  
  const now = new Date();
  
  switch (duration) {
    case CouponDuration.ONE_HOUR:
      now.setHours(now.getHours() + 1);
      break;
    case CouponDuration.ONE_DAY:
      now.setHours(now.getHours() + 24);
      break;
    case CouponDuration.TWO_DAYS:
      now.setHours(now.getHours() + 48);
      break;
    case CouponDuration.ONE_WEEK:
      now.setDate(now.getDate() + 7);
      break;
    default:
      return null;
  }
  
  return now;
}