/**
 * Utilidades para ayudar con los cortes de caja
 * Esta solución garantiza que los datos mostrados en el modal sean actuales
 */

// Función para obtener datos frescos de la caja
export async function getFreshCashboxData() {
  console.log("Obteniendo datos frescos para el corte de caja");
  
  try {
    // Forzar actualización de datos del servidor
    const response = await fetch('/api/cashbox/transactions', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error("Error al obtener datos frescos");
    }
    
    const data = await response.json();
    console.log("Datos frescos obtenidos:", data.length, "transacciones");
    
    // Calcular totales con los datos frescos
    let totalCash = 0;
    let totalTransfer = 0;
    
    // Procesar cada transacción para obtener los totales exactos
    data.forEach((t) => {
      // Manejar pagos en efectivo
      if (t.advancePaymentMethod === 'efectivo') {
        totalCash += t.advanceAmount || 0;
      }
      if (t.paymentMethod === 'efectivo') {
        totalCash += (t.totalAmount || 0) - (t.advanceAmount || 0);
      }
      
      // Manejar pagos por transferencia
      if (t.advancePaymentMethod === 'transferencia') {
        totalTransfer += t.advanceAmount || 0;
      }
      if (t.paymentMethod === 'transferencia') {
        totalTransfer += (t.totalAmount || 0) - (t.advanceAmount || 0);
      }
    });
    
    const totalAmount = totalCash + totalTransfer;
    
    console.log("Totales calculados directamente:", { 
      totalCash, 
      totalTransfer,
      totalAmount,
      transactionCount: data.length
    });
    
    return {
      transactions: data,
      totalCash,
      totalTransfer,
      totalAmount,
      transactionCount: data.length
    };
  } catch (error) {
    console.error("Error al obtener datos frescos:", error);
    return null;
  }
}

// Función para preparar datos del corte
export function prepareCutoffData(user, freshData) {
  if (!user || !freshData) return null;
  
  return {
    user: `${user.firstName} ${user.lastName}`,
    date: new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    totalAmount: freshData.totalAmount,
    totalCash: freshData.totalCash,
    totalTransfer: freshData.totalTransfer,
    transactionCount: freshData.transactionCount,
    transactions: freshData.transactions
  };
}