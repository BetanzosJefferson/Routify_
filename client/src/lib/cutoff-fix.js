/**
 * Script para solucionar el problema del modal de corte que muestra datos desactualizados
 * 
 * Esta solución debe ser integrada en la página de caja registradora
 * para garantizar que los datos del modal sean actualizados correctamente.
 */

// Función para obtener datos frescos directamente del servidor
export async function getFreshCashboxData() {
  console.log("Obteniendo datos frescos para el corte de caja");
  
  try {
    // Forzar actualización de datos del servidor sin usar caché
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
      data,
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

// Instrucciones para aplicar esta solución:
// 
// 1. Desde la consola del navegador, ejecuta el siguiente código para obtener
//    los datos actualizados antes de hacer el corte:
//
//    async function fixCutoffData() {
//      const freshData = await window.getFreshCashboxData();
//      if (freshData) {
//        localStorage.setItem('freshCutoffData', JSON.stringify({
//          totalCash: freshData.totalCash,
//          totalTransfer: freshData.totalTransfer,
//          totalAmount: freshData.totalAmount,
//          transactionCount: freshData.transactionCount,
//          timestamp: new Date().getTime()
//        }));
//        console.log("Datos frescos guardados en localStorage");
//      }
//    }
//
//    window.getFreshCashboxData = getFreshCashboxData;
//    window.fixCutoffData = fixCutoffData;
//
// 2. Antes de hacer un corte, ejecuta:
//    window.fixCutoffData().then(() => console.log("Listo para hacer corte"))
//
// 3. Cuando el modal se abra, los datos pueden verse desactualizados en la interfaz,
//    pero los datos correctos están en localStorage y serán usados para el corte.