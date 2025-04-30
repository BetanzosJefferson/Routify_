import { db } from "../db";
import { sql, eq, and, gt, lt } from "drizzle-orm";
import { coupons, insertCouponSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";

export type CouponCreateInput = z.infer<typeof insertCouponSchema>;

export class CouponService {
  /**
   * Genera un código aleatorio para un cupón
   * @param length Longitud del código (por defecto 5)
   * @returns Código aleatorio en formato alfanumérico
   */
  static generateRandomCode(length: number = 5): string {
    // Generar bytes aleatorios y convertirlos a una cadena hexadecimal
    const randomBuffer = randomBytes(Math.ceil(length / 2));
    const randomHex = randomBuffer.toString('hex').slice(0, length);
    
    // Convertir a mayúsculas para mejor legibilidad
    return randomHex.toUpperCase();
  }

  /**
   * Crea un nuevo cupón
   * @param data Datos del cupón a crear
   * @returns El cupón creado
   */
  static async createCoupon(data: CouponCreateInput) {
    try {
      // Si no se proporciona código, generar uno aleatorio
      if (!data.code) {
        data.code = this.generateRandomCode();
        
        // Verificar que el código generado no exista ya
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 5) {
          const existingCoupon = await db
            .select({ id: coupons.id })
            .from(coupons)
            .where(eq(coupons.code, data.code))
            .limit(1);
          
          isUnique = existingCoupon.length === 0;
          
          if (!isUnique) {
            data.code = this.generateRandomCode();
            attempts++;
          }
        }
        
        if (!isUnique) {
          throw new Error("No se pudo generar un código único después de 5 intentos");
        }
      }
      
      const [coupon] = await db.insert(coupons).values({
        ...data
      }).returning();
      
      return coupon;
    } catch (error) {
      console.error("Error al crear cupón:", error);
      throw error;
    }
  }

  /**
   * Obtiene todos los cupones
   * @param companyId ID de la compañía para filtrar (opcional)
   * @returns Lista de cupones
   */
  static async getCoupons(companyId?: string) {
    try {
      if (companyId) {
        return await db
          .select()
          .from(coupons)
          .where(eq(coupons.companyId, companyId))
          .orderBy(sql`${coupons.createdAt} DESC`);
      }
      
      return await db
        .select()
        .from(coupons)
        .orderBy(sql`${coupons.createdAt} DESC`);
    } catch (error) {
      console.error("Error al obtener cupones:", error);
      throw error;
    }
  }

  /**
   * Obtiene un cupón por su ID
   * @param id ID del cupón
   * @returns El cupón o undefined si no existe
   */
  static async getCouponById(id: number) {
    try {
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(eq(coupons.id, id));
      
      return coupon;
    } catch (error) {
      console.error("Error al obtener cupón por ID:", error);
      throw error;
    }
  }

  /**
   * Obtiene un cupón por su código
   * @param code Código del cupón
   * @returns El cupón o undefined si no existe
   */
  static async getCouponByCode(code: string) {
    try {
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(eq(coupons.code, code));
      
      return coupon;
    } catch (error) {
      console.error("Error al obtener cupón por código:", error);
      throw error;
    }
  }

  /**
   * Actualiza un cupón
   * @param id ID del cupón a actualizar
   * @param data Datos a actualizar
   * @returns El cupón actualizado o undefined si no existe
   */
  static async updateCoupon(id: number, data: Partial<CouponCreateInput>) {
    try {
      const [updatedCoupon] = await db
        .update(coupons)
        .set({
          ...data
        })
        .where(eq(coupons.id, id))
        .returning();
      
      return updatedCoupon;
    } catch (error) {
      console.error("Error al actualizar cupón:", error);
      throw error;
    }
  }

  /**
   * Elimina un cupón
   * @param id ID del cupón a eliminar
   * @returns true si se eliminó correctamente, false si no existe
   */
  static async deleteCoupon(id: number) {
    try {
      const result = await db
        .delete(coupons)
        .where(eq(coupons.id, id))
        .returning({ id: coupons.id });
      
      return result.length > 0;
    } catch (error) {
      console.error("Error al eliminar cupón:", error);
      throw error;
    }
  }

  /**
   * Valida un cupón verificando si existe, si está vigente y si tiene usos disponibles
   * @param code Código del cupón a validar
   * @param companyId ID de la compañía para validar que el cupón pertenezca a ella
   * @returns El cupón si es válido, null si no lo es
   */
  static async validateCoupon(code: string, companyId?: string) {
    try {
      if (!code) return null;
      
      // Buscar el cupón por código
      const coupon = await this.getCouponByCode(code);
      
      // Si no existe, retornar null
      if (!coupon) return null;
      
      // Si hay companyId y el cupón tiene companyId diferente, retornar null
      if (companyId && coupon.companyId && coupon.companyId !== companyId) {
        console.log(`Cupón ${code} no pertenece a la compañía ${companyId}, sino a ${coupon.companyId}`);
        return null;
      }
      
      // Verificar si el cupón ha expirado
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        console.log(`Cupón ${code} expirado el ${coupon.expiresAt}`);
        return null;
      }
      
      // Verificar si el cupón está activo
      if (coupon.isActive === false) {
        console.log(`Cupón ${code} no está activo`);
        return null;
      }
      
      return coupon;
    } catch (error) {
      console.error("Error al validar cupón:", error);
      return null;
    }
  }

  /**
   * Aplica un cupón a un monto total
   * @param code Código del cupón
   * @param amount Monto al que se aplicará el descuento
   * @param companyId ID de la compañía para validar que el cupón pertenezca a ella
   * @returns Objeto con información del descuento o null si el cupón no es válido
   */
  static async applyCoupon(code: string, amount: number, companyId?: string) {
    try {
      // Validar el cupón
      const coupon = await this.validateCoupon(code, companyId);
      
      // Si el cupón no es válido, retornar null
      if (!coupon) return null;
      
      let discountAmount = 0;
      
      // Calcular el descuento según el tipo
      if (coupon.discountType === "percentage") {
        // Descuento porcentual
        discountAmount = (amount * coupon.discountValue) / 100;
        
        // Aplicar el descuento porcentual
      } else {
        // Descuento de monto fijo
        discountAmount = coupon.discountValue;
        
        // El descuento no puede ser mayor que el monto total
        if (discountAmount > amount) {
          discountAmount = amount;
        }
      }
      
      // Calcular el monto final
      const finalAmount = amount - discountAmount;
      
      // Actualizar el contador de usos del cupón
      await this.updateCoupon(coupon.id, {
        usedCount: (coupon.usedCount || 0) + 1
      });
      
      return {
        couponId: coupon.id,
        code: coupon.code,
        originalAmount: amount,
        discountAmount,
        finalAmount,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };
    } catch (error) {
      console.error("Error al aplicar cupón:", error);
      return null;
    }
  }
}