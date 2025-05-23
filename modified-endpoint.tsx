// GET /api/cash-register - Obtener reservaciones con anticipos y restantes registrados por el usuario
app.get(apiRouter('/cash-register'), isAuthenticated, async (req, res) => {
  try {
    const { user } = req as any;
    console.log(`[GET /cash-register] Usuario ${user.firstName} ${user.lastName} solicitando datos de caja`);
    
    // Obtener todas las reservaciones para procesarlas
    const allReservations = await storage.getReservations();
    console.log(`[GET /cash-register] Analizando ${allReservations.length} reservaciones para la caja del usuario ${user.id}`);
    
    // Array para almacenar los ítems de caja (anticipos y restantes)
    let cashboxItems: any[] = [];
    
    // Recorrer todas las reservaciones
    for (const reservation of allReservations) {
      // 1. Anticipos: Si el usuario creó la reservación y tiene anticipo
      if (reservation.createdBy === user.id && reservation.advanceAmount && reservation.advanceAmount > 0) {
        console.log(`[GET /cash-register] Añadiendo anticipo de ${reservation.advanceAmount} de reserva ${reservation.id}`);
        
        // Crear un ítem de caja para el anticipo
        cashboxItems.push({
          ...reservation,
          totalAmount: reservation.advanceAmount, // Solo monto del anticipo
          paymentNote: "Anticipo", // Indicamos que es un anticipo
          paymentMethod: reservation.advancePaymentMethod,
          paymentDate: reservation.createdAt,
          cashItemId: `anticipo-${reservation.id}`,
          originalReservationId: reservation.id
        });
      }
      
      // 2. Pagos restantes: Si el usuario marcó como pagado el restante
      if (reservation.paidBy === user.id) {
        const restanteAmount = (reservation.totalAmount || 0) - (reservation.advanceAmount || 0);
        
        // Solo incluir si hay monto restante
        if (restanteAmount > 0) {
          console.log(`[GET /cash-register] Añadiendo restante de ${restanteAmount} de reserva ${reservation.id}`);
          
          // Crear un ítem de caja para el pago restante
          cashboxItems.push({
            ...reservation,
            totalAmount: restanteAmount, // Solo monto del restante
            paymentNote: "Restante", // Indicamos que es un restante
            paymentMethod: reservation.paymentMethod,
            paymentDate: reservation.paidAt,
            cashItemId: `restante-${reservation.id}`,
            originalReservationId: reservation.id
          });
        }
      }
    }
    
    console.log(`[GET /cash-register] Se encontraron ${cashboxItems.length} ítems de caja para el usuario ${user.id}`);
    
    // Si el usuario es taquillero, filtrar por compañías
    if (user.role === UserRole.TICKET_OFFICE) {
      // Obtener compañías asociadas
      const userCompanyAssociations = await db
        .select()
        .from(userCompanies)
        .where(eq(userCompanies.userId, user.id));
      
      if (userCompanyAssociations.length === 0) {
        console.log(`[GET /cash-register] Taquillero sin compañías asociadas, no se mostrarán reservaciones`);
        return res.json([]);
      }
      
      // Obtener IDs de compañías
      const associatedCompanyIds = userCompanyAssociations.map(assoc => assoc.companyId);
      
      // Filtrar por compañías asociadas
      cashboxItems = cashboxItems.filter(item => {
        const tripCompanyId = item.trip?.companyId || null;
        return tripCompanyId && associatedCompanyIds.includes(tripCompanyId);
      });
    }
    
    // Enriquecer con información de compañía para usuarios especiales
    if ([UserRole.TICKET_OFFICE, UserRole.OWNER, UserRole.ADMIN, "dueño"].includes(user.role)) {
      const enrichedItems = await Promise.all(
        cashboxItems.map(async (item) => {
          // Obtener la compañía del viaje
          let companyId = null;
          let companyName = "Desconocida";
          
          if (item.trip && item.trip.companyId) {
            companyId = item.trip.companyId;
            
            try {
              const company = await storage.getCompanyById(companyId);
              if (company) {
                companyName = company.name || companyId;
              }
            } catch (err) {
              console.error(`Error al obtener información de la compañía ${companyId}:`, err);
            }
          }
          
          return {
            ...item,
            companyInfo: {
              id: companyId,
              name: companyName
            }
          };
        })
      );
      
      return res.json(enrichedItems);
    }
    
    // Para usuarios normales
    return res.json(cashboxItems);
  } catch (error) {
    console.error('[GET /cash-register] Error:', error);
    res.status(500).json({ error: "Error al obtener pagos registrados" });
  }
});