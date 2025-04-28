// Estados de pago
export const PaymentStatus = {
  PENDING: 'pendiente',
  PAID: 'pagado',
  CANCELLED: 'cancelado',
} as const;

// Métodos de pago
export const PaymentMethod = {
  CASH: 'efectivo',
  TRANSFER: 'transferencia',
} as const;

// Estados de reservación
export const ReservationStatus = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
} as const;