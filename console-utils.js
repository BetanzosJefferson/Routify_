// Funciones de utilidad para consultas desde el console del navegador

/**
 * Función para obtener las cajas de usuarios de la compañía
 * Uso: await getUserCashBoxes()
 */
async function getUserCashBoxes() {
  try {
    console.log('[getUserCashBoxes] Iniciando consulta de cajas de usuarios...');
    
    const response = await fetch('/api/transactions/user-cash-boxes', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('[getUserCashBoxes] Respuesta recibida:', data);
    console.log('[getUserCashBoxes] Total de transacciones encontradas:', data.length);
    
    // Mostrar resumen de transacciones por usuario
    if (data.length > 0) {
      const userSummary = data.reduce((acc, transaction) => {
        const userId = transaction.userId || 'Sin usuario';
        const userName = transaction.userName || 'Nombre no disponible';
        
        if (!acc[userId]) {
          acc[userId] = {
            name: userName,
            count: 0,
            totalAmount: 0,
            transactions: []
          };
        }
        
        acc[userId].count++;
        acc[userId].totalAmount += transaction.amount || 0;
        acc[userId].transactions.push(transaction);
        
        return acc;
      }, {});
      
      console.log('[getUserCashBoxes] Resumen por usuario:');
      console.table(Object.entries(userSummary).map(([userId, info]) => ({
        'ID Usuario': userId,
        'Nombre': info.name,
        'Transacciones': info.count,
        'Monto Total': info.totalAmount
      })));
    }
    
    return data;
    
  } catch (error) {
    console.error('[getUserCashBoxes] Error al obtener cajas de usuarios:', error);
    throw error;
  }
}

/**
 * Función para obtener información específica de un usuario
 * Uso: await getUserCashBoxInfo(userId)
 */
async function getUserCashBoxInfo(userId) {
  try {
    console.log(`[getUserCashBoxInfo] Obteniendo información para usuario ID: ${userId}`);
    
    const allData = await getUserCashBoxes();
    const userTransactions = allData.filter(transaction => transaction.userId === userId);
    
    if (userTransactions.length === 0) {
      console.log(`[getUserCashBoxInfo] No se encontraron transacciones para el usuario ${userId}`);
      return [];
    }
    
    console.log(`[getUserCashBoxInfo] Encontradas ${userTransactions.length} transacciones para el usuario ${userId}`);
    console.table(userTransactions.map(t => ({
      'ID': t.id,
      'Tipo': t.detalles?.type || 'Sin tipo',
      'Monto': t.amount,
      'Fecha': new Date(t.createdAt).toLocaleString('es-MX'),
      'Descripción': t.detalles?.description || 'Sin descripción'
    })));
    
    return userTransactions;
    
  } catch (error) {
    console.error(`[getUserCashBoxInfo] Error al obtener información del usuario ${userId}:`, error);
    throw error;
  }
}

/**
 * Función para obtener estadísticas generales de las cajas
 * Uso: await getCashBoxStats()
 */
async function getCashBoxStats() {
  try {
    console.log('[getCashBoxStats] Calculando estadísticas de cajas...');
    
    const data = await getUserCashBoxes();
    
    if (data.length === 0) {
      console.log('[getCashBoxStats] No hay datos disponibles');
      return null;
    }
    
    const stats = {
      totalTransactions: data.length,
      totalAmount: data.reduce((sum, t) => sum + (t.amount || 0), 0),
      uniqueUsers: new Set(data.map(t => t.userId)).size,
      transactionTypes: {},
      averageAmount: 0
    };
    
    // Contar tipos de transacciones
    data.forEach(transaction => {
      const type = transaction.detalles?.type || 'Sin tipo';
      stats.transactionTypes[type] = (stats.transactionTypes[type] || 0) + 1;
    });
    
    stats.averageAmount = stats.totalAmount / stats.totalTransactions;
    
    console.log('[getCashBoxStats] Estadísticas calculadas:');
    console.table([{
      'Total Transacciones': stats.totalTransactions,
      'Monto Total': `$${stats.totalAmount.toFixed(2)}`,
      'Usuarios Únicos': stats.uniqueUsers,
      'Promedio por Transacción': `$${stats.averageAmount.toFixed(2)}`
    }]);
    
    console.log('[getCashBoxStats] Tipos de transacciones:');
    console.table(stats.transactionTypes);
    
    return stats;
    
  } catch (error) {
    console.error('[getCashBoxStats] Error al calcular estadísticas:', error);
    throw error;
  }
}

// Hacer las funciones disponibles globalmente
window.getUserCashBoxes = getUserCashBoxes;
window.getUserCashBoxInfo = getUserCashBoxInfo;
window.getCashBoxStats = getCashBoxStats;

console.log(`
🔧 Funciones de Console disponibles:

📊 getUserCashBoxes() - Obtiene todas las cajas de usuarios de la compañía
👤 getUserCashBoxInfo(userId) - Obtiene información específica de un usuario
📈 getCashBoxStats() - Calcula estadísticas generales de las cajas

Ejemplo de uso:
await getUserCashBoxes()
await getUserCashBoxInfo(24)
await getCashBoxStats()
`);