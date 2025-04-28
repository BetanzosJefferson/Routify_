export const PaymentMethod = {
  CASH: 'efectivo',
  TRANSFER: 'transferencia'
} as const;

export const PaymentStatus = {
  PENDING: 'pendiente',
  PAID: 'pagado'
} as const;