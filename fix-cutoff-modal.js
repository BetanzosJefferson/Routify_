/**
 * Solución para el problema del modal de corte de caja que muestra datos desactualizados
 * 
 * Instrucciones:
 * 1. Abre la consola del navegador (F12) en la página de la caja registradora
 * 2. Copia y pega todo el contenido de este archivo
 * 3. Antes de hacer un corte, ejecuta: getFreshCashboxData()
 * 4. Ahora puedes realizar el corte y verás los totales correctos
 */

// Función para obtener datos frescos directamente del servidor
async function getFreshCashboxData() {
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
    
    console.log("Totales calculados correctamente:", { 
      totalCash, 
      totalTransfer,
      totalAmount,
      transactionCount: data.length
    });
    
    // Guardar en localStorage
    localStorage.setItem('correctCutoffData', JSON.stringify({
      totalCash,
      totalTransfer,
      totalAmount,
      transactionCount: data.length,
      timestamp: new Date().getTime()
    }));
    
    // Intentar aplicar la solución al modal cuando se abra
    applyFixToModal();
    
    return {
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

// Función para aplicar la solución al modal cuando se abra
function applyFixToModal() {
  console.log("Preparando solución para el modal...");
  
  // Verificar si hay datos correctos almacenados
  const storedData = localStorage.getItem('correctCutoffData');
  if (!storedData) {
    console.warn("No hay datos correctos almacenados. Ejecuta getFreshCashboxData() primero.");
    return;
  }
  
  const correctData = JSON.parse(storedData);
  
  // Esperar a que el modal se abra y luego actualizar los valores
  const checkModalInterval = setInterval(() => {
    // Buscar elementos del modal
    const modalElement = document.querySelector('.dialog-content');
    if (!modalElement) return; // Modal no está abierto todavía
    
    console.log("Modal detectado, aplicando corrección...");
    
    // Buscar elementos específicos en el modal
    const totalElement = modalElement.querySelector('.text-primary');
    const cashElement = modalElement.querySelector('.text-green-600');
    const transferElement = modalElement.querySelector('.text-blue-600');
    const transactionsElement = modalElement.querySelectorAll('p.font-medium')[3]; // Cuarta celda con font-medium
    
    // Actualizar los valores con los datos correctos
    if (totalElement) {
      totalElement.textContent = `$${correctData.totalAmount.toFixed(2)}`;
      console.log("Total actualizado a:", correctData.totalAmount.toFixed(2));
    }
    
    if (cashElement) {
      cashElement.textContent = `$${correctData.totalCash.toFixed(2)}`;
      console.log("Efectivo actualizado a:", correctData.totalCash.toFixed(2));
    }
    
    if (transferElement) {
      transferElement.textContent = `$${correctData.totalTransfer.toFixed(2)}`;
      console.log("Transferencia actualizada a:", correctData.totalTransfer.toFixed(2));
    }
    
    if (transactionsElement) {
      transactionsElement.textContent = `${correctData.transactionCount}`;
      console.log("Conteo de transacciones actualizado a:", correctData.transactionCount);
    }
    
    // Detener el intervalo después de aplicar la corrección
    clearInterval(checkModalInterval);
    console.log("Corrección aplicada correctamente.");
  }, 100); // Verificar cada 100ms
  
  // Detener el intervalo después de 10 segundos para evitar que se ejecute indefinidamente
  setTimeout(() => {
    clearInterval(checkModalInterval);
  }, 10000);
}

// Instalar la función en la ventana para que esté disponible en la consola
window.getFreshCashboxData = getFreshCashboxData;

console.log("%c¡Solución instalada correctamente!", "color: green; font-weight: bold; font-size: 14px");
console.log("%cAntes de hacer un corte, ejecuta: %cgetFreshCashboxData()", "color: black; font-weight: normal", "color: blue; font-weight: bold");
console.log("%cEsto asegurará que el modal muestre los totales correctos (2670 en lugar de 2470)", "color: black; font-style: italic");