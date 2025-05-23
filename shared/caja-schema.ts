import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, companies, reservations, packages } from "./schema";

// ========== SISTEMA DE CAJAS SIMPLIFICADO ==========

// Estado de la transacción de caja
export const TransactionStatus = {
  SIN_CORTAR: "sin-cortar",   // Transacción pendiente de corte
  CORTADO: "cortado"          // Transacción incluida en un corte
} as const;

export type TransactionStatusType = typeof TransactionStatus[keyof typeof TransactionStatus];

// Enum para tipo de transacción
export const TransactionType = {
  ANTICIPO: "anticipo",        // Anticipo de reservación
  RESTANTE: "restante",        // Pago restante de reservación
  PAQUETERIA: "paqueteria",    // Pago de paquetería
  GASTO: "gasto",              // Gasto registrado
  CORTE: "corte"               // Registro de corte
} as const;

export type TransactionTypeType = typeof TransactionType[keyof typeof TransactionType];

// Enum para método de pago
export const PaymentMethods = {
  EFECTIVO: "efectivo",        
  TRANSFERENCIA: "transferencia"
} as const;

// TRANSACCIONES DE CAJA
export const cajaTransacciones = pgTable("caja_transacciones", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull(),         // Usuario que registró la transacción
  companyId: text("company_id").notNull(),            // Compañía a la que pertenece la transacción
  tipo: text("tipo").notNull(),                       // anticipo, restante, paqueteria, gasto, corte
  monto: doublePrecision("monto").notNull(),          // Monto de la transacción
  metodoPago: text("metodo_pago").notNull(),          // efectivo, transferencia
  estado: text("estado").notNull().default("sin-cortar"), // sin-cortar, cortado
  reservacionId: integer("reservacion_id"),           // Referencia a reservación (si aplica)
  paqueteriaId: integer("paqueteria_id"),             // Referencia a paquetería (si aplica)
  corteId: integer("corte_id"),                       // Corte al que pertenece (si está cortado)
  descripcion: text("descripcion"),                   // Descripción adicional
  referencia: text("referencia"),                     // Identificador adicional (ej. nombre pasajero)
  createdAt: timestamp("created_at").defaultNow(),    // Fecha de creación
  updatedAt: timestamp("updated_at")                  // Fecha de actualización
});

export const insertCajaTransaccionSchema = createInsertSchema(cajaTransacciones, {
  estado: z.string().default("sin-cortar"),
  reservacionId: z.number().optional(),
  paqueteriaId: z.number().optional(),
  corteId: z.number().optional(),
  descripcion: z.string().optional(),
  referencia: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type InsertCajaTransaccion = z.infer<typeof insertCajaTransaccionSchema>;
export type CajaTransaccion = typeof cajaTransacciones.$inferSelect;

// CORTES DE CAJA
export const cortesCaja = pgTable("cortes_caja", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull(),         // Usuario que realizó el corte
  companyId: text("company_id").notNull(),            // Compañía a la que pertenece el corte
  totalEfectivo: doublePrecision("total_efectivo").notNull(),        // Total en efectivo
  totalTransferencia: doublePrecision("total_transferencia").notNull(), // Total en transferencia
  totalGeneral: doublePrecision("total_general").notNull(),           // Total general
  cantidadTransacciones: integer("cantidad_transacciones").notNull(),  // Número de transacciones
  notas: text("notas"),                               // Notas adicionales
  createdAt: timestamp("created_at").defaultNow(),    // Fecha de creación
  impreso: boolean("impreso").default(false)          // Si se ha impreso el corte
});

export const insertCorteCajaSchema = createInsertSchema(cortesCaja, {
  notas: z.string().optional(),
  createdAt: z.date().optional(),
  impreso: z.boolean().default(false)
});

export type InsertCorteCaja = z.infer<typeof insertCorteCajaSchema>;
export type CorteCaja = typeof cortesCaja.$inferSelect;

// RELACIONES
export const cajaTransaccionRelations = relations(cajaTransacciones, ({ one }) => ({
  usuario: one(users, {
    fields: [cajaTransacciones.usuarioId],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [cajaTransacciones.companyId],
    references: [companies.identifier]
  }),
  reservacion: one(reservations, {
    fields: [cajaTransacciones.reservacionId],
    references: [reservations.id]
  }),
  paqueteria: one(packages, {
    fields: [cajaTransacciones.paqueteriaId],
    references: [packages.id]
  }),
  corte: one(cortesCaja, {
    fields: [cajaTransacciones.corteId],
    references: [cortesCaja.id]
  })
}));

export const corteCajaRelations = relations(cortesCaja, ({ one, many }) => ({
  usuario: one(users, {
    fields: [cortesCaja.usuarioId],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [cortesCaja.companyId],
    references: [companies.identifier]
  }),
  transacciones: many(cajaTransacciones)
}));