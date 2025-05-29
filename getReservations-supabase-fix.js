// Temporary fix for Supabase getReservations function
// This is a simplified version that avoids complex JOIN operations

async function getReservationsSupabaseFix(companyId, tripId, companyIds, dateFilter) {
  console.log('[SUPABASE FIX] Iniciando consulta simplificada');
  
  try {
    const { db, schema, eq, and, inArray, sql } = require('./db');
    
    // Step 1: Build basic where conditions
    const conditions = [];
    
    if (tripId) {
      conditions.push(eq(schema.reservations.tripId, tripId));
    }
    
    if (companyId) {
      conditions.push(eq(schema.reservations.companyId, companyId));
    }
    
    if (companyIds && companyIds.length > 0 && !companyId) {
      conditions.push(inArray(schema.reservations.companyId, companyIds));
    }
    
    // Step 2: Handle date filter by getting trip IDs first
    if (dateFilter) {
      const tripsOnDate = await db
        .select({ id: schema.trips.id })
        .from(schema.trips)
        .where(sql`DATE(departure_date) = ${dateFilter}`);
      
      const tripIds = tripsOnDate.map(trip => trip.id);
      
      if (tripIds.length === 0) {
        return [];
      }
      
      conditions.push(inArray(schema.reservations.tripId, tripIds));
    }
    
    // Step 3: Get reservations with simple query
    let query = db.select().from(schema.reservations);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const reservations = await query;
    
    // Step 4: Process each reservation individually
    const result = [];
    
    for (const reservation of reservations) {
      // Get trip
      const [trip] = await db
        .select()
        .from(schema.trips)
        .where(eq(schema.trips.id, reservation.tripId));
      
      if (!trip) continue;
      
      // Get route
      let route = null;
      if (trip.routeId) {
        const [routeData] = await db
          .select()
          .from(schema.routes)
          .where(eq(schema.routes.id, trip.routeId));
        route = routeData || null;
      }
      
      // Get passengers
      const passengers = await db
        .select()
        .from(schema.passengers)
        .where(eq(schema.passengers.reservationId, reservation.id));
      
      result.push({
        ...reservation,
        trip: {
          ...trip,
          route
        },
        passengers: passengers || []
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('[SUPABASE FIX] Error:', error);
    return [];
  }
}

module.exports = { getReservationsSupabaseFix };