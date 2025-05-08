/**
 * Funciones de utilidad para el manejo de viajes
 */

// Función para determinar si dos ubicaciones pertenecen a la misma ciudad
// Esta función es simple por ahora, podría mejorarse con un algoritmo más sofisticado
export function isSameCity(location1: string, location2: string): boolean {
  // Eliminar espacios en blanco y convertir a minúsculas para comparación
  const normalize = (loc: string) => loc.trim().toLowerCase();
  
  const loc1 = normalize(location1);
  const loc2 = normalize(location2);
  
  // Comparar directamente
  if (loc1 === loc2) return true;
  
  // Comparar la ciudad base (antes de una coma o paréntesis)
  const getBaseCity = (loc: string) => {
    // Extraer la parte antes de coma o paréntesis
    const commaIndex = loc.indexOf(',');
    const parenIndex = loc.indexOf('(');
    
    if (commaIndex > 0) {
      return loc.substring(0, commaIndex).trim();
    }
    
    if (parenIndex > 0) {
      return loc.substring(0, parenIndex).trim();
    }
    
    return loc;
  };
  
  const base1 = getBaseCity(loc1);
  const base2 = getBaseCity(loc2);
  
  return base1 === base2;
}

// Calcular precio proporcional basado en la distancia entre paradas
export function calculateProportionalPrice(
  segment: { origin: string, destination: string, price?: number },
  route: { origin: string, destination: string, stops: string[] },
  totalPrice: number
): number {
  // Crear un array con todas las paradas en orden
  const allStops = [route.origin, ...route.stops, route.destination];
  
  // Encontrar los índices de origen y destino del segmento
  const originIndex = allStops.findIndex(stop => stop === segment.origin);
  const destIndex = allStops.findIndex(stop => stop === segment.destination);
  
  if (originIndex === -1 || destIndex === -1) {
    console.log(`No se encontró índice para origen ${segment.origin} o destino ${segment.destination}`);
    return 0;
  }
  
  // Calcular la proporción del segmento respecto al total de la ruta
  const totalSegments = allStops.length - 1;
  const segmentDistance = destIndex - originIndex;
  
  // Calcular precio proporcional
  const proportion = segmentDistance / totalSegments;
  const proportionalPrice = Math.round(totalPrice * proportion);
  
  return proportionalPrice;
}

// Generar todos los posibles segmentos entre paradas de una ruta
export function generateAllPossibleSegments(route: { origin: string, stops: string[], destination: string }) {
  const allPoints = [route.origin, ...route.stops, route.destination];
  const allSegments = [];
  
  // Generar todas las combinaciones posibles (no solo paradas consecutivas)
  for (let i = 0; i < allPoints.length - 1; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      // Saltar la ruta principal (origen a destino) si se maneja por separado
      if (i === 0 && j === allPoints.length - 1) {
        continue;
      }
      
      // Saltar segmentos donde origen y destino están en la misma ciudad
      if (isSameCity(allPoints[i], allPoints[j])) {
        continue;
      }
      
      // Determinar si es un segmento significativo
      const isShortSegment = j === i + 1;
      const isFirstToSecond = i === 0 && j === 1; // Origen a primera parada
      const isSecondToLast = j === allPoints.length - 1 && i === allPoints.length - 2; // Última parada a destino
      
      // Solo incluir segmentos cortos si son significativos o si la ruta tiene pocas paradas
      if (isShortSegment && !isFirstToSecond && !isSecondToLast && allPoints.length > 3) {
        continue;
      }
      
      allSegments.push({
        origin: allPoints[i],
        destination: allPoints[j],
        price: 0
      });
    }
  }
  
  return allSegments;
}

// Calcular tiempos de salida y llegada para segmentos basados en tiempo total de viaje
export function calculateSegmentTimes(
  segments: { origin: string; destination: string; price: number; stopTimes?: any[]; segmentPrices?: any[] }[],
  mainDepartureTime: string,
  mainArrivalTime: string,
  route: { origin: string, stops: string[], destination: string }
) {
  const allPoints = [route.origin, ...route.stops, route.destination];
  const totalPoints = allPoints.length;
  const totalSegments = totalPoints - 1;
  
  // Mapa de tiempos para cada segmento
  const segmentTimes: Record<string, { departureTime: string; arrivalTime: string }> = {};
  
  // Crear un mapa de índices para ubicar rápidamente la posición de cada parada
  const stopIndexMap = new Map<string, number>();
  allPoints.forEach((stop, index) => stopIndexMap.set(stop, index));
  
  // Parsear los tiempos principales para calcular duración total del viaje
  const parseDepartureTime = parseTimeString(mainDepartureTime);
  const parseArrivalTime = parseTimeString(mainArrivalTime);
  
  if (!parseDepartureTime || !parseArrivalTime) {
    console.log("Error parseando tiempos de salida/llegada principal");
    return segmentTimes;
  }
  
  // Calcular duración total en minutos
  let totalDurationMinutes = calculateTimeDifferenceInMinutes(
    parseDepartureTime.hours,
    parseDepartureTime.minutes,
    parseDepartureTime.isPM,
    parseArrivalTime.hours,
    parseArrivalTime.minutes,
    parseArrivalTime.isPM
  );
  
  // Si hay tiempos personalizados en stopTimes, usarlos como base
  const stopTimes = segments[0]?.stopTimes;
  if (stopTimes && Array.isArray(stopTimes) && stopTimes.length >= totalPoints) {
    // Convertir el arreglo de stopTimes a un mapa para acceder más fácilmente
    const stopTimeMap = new Map();
    stopTimes.forEach((timeData, index) => {
      if (timeData && timeData.hour && timeData.minute && timeData.ampm) {
        stopTimeMap.set(index, {
          hour: timeData.hour,
          minute: timeData.minute,
          ampm: timeData.ampm
        });
      }
    });
    
    // Calcular tiempos de salida/llegada para cada segmento basado en los stopTimes personalizados
    for (const segment of segments) {
      const originIndex = stopIndexMap.get(segment.origin);
      const destIndex = stopIndexMap.get(segment.destination);
      
      if (originIndex !== undefined && destIndex !== undefined) {
        const originTimeData = stopTimeMap.get(originIndex);
        const destTimeData = stopTimeMap.get(destIndex);
        
        if (originTimeData && destTimeData) {
          const departureTime = `${originTimeData.hour}:${originTimeData.minute} ${originTimeData.ampm}`;
          const arrivalTime = `${destTimeData.hour}:${destTimeData.minute} ${destTimeData.ampm}`;
          
          const key = `${segment.origin}-${segment.destination}`;
          segmentTimes[key] = { departureTime, arrivalTime };
        }
      }
    }
  } else {
    // Calcular tiempos proporcionalmente basados en la distancia si no hay tiempos personalizados
    for (const segment of segments) {
      const originIndex = stopIndexMap.get(segment.origin);
      const destIndex = stopIndexMap.get(segment.destination);
      
      if (originIndex === undefined || destIndex === undefined) continue;
      
      // Calcular la proporción de tiempo para este segmento basado en su "distancia" relativa
      const segmentDistance = destIndex - originIndex;
      const proportion = segmentDistance / totalSegments;
      
      // Calcular los minutos adicionales para la salida y llegada proporcionales
      const departureOffsetMinutes = Math.round(
        totalDurationMinutes * (originIndex / totalSegments)
      );
      const arrivalOffsetMinutes = Math.round(
        totalDurationMinutes * (destIndex / totalSegments)
      );
      
      // Calcular los tiempos de salida y llegada
      const departureTime = addMinutesToTime(
        parseDepartureTime.hours,
        parseDepartureTime.minutes,
        parseDepartureTime.isPM,
        departureOffsetMinutes
      );
      
      const arrivalTime = addMinutesToTime(
        parseDepartureTime.hours,
        parseDepartureTime.minutes,
        parseDepartureTime.isPM,
        arrivalOffsetMinutes
      );
      
      const key = `${segment.origin}-${segment.destination}`;
      segmentTimes[key] = {
        departureTime: formatTime(departureTime.hours, departureTime.minutes, departureTime.isPM),
        arrivalTime: formatTime(arrivalTime.hours, arrivalTime.minutes, arrivalTime.isPM)
      };
    }
  }
  
  return segmentTimes;
}

// Funciones auxiliares para manejo de tiempo

function parseTimeString(timeStr: string) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  
  let [, hours, minutes, ampm] = match;
  const isPM = ampm.toUpperCase() === 'PM';
  
  return {
    hours: parseInt(hours, 10),
    minutes: parseInt(minutes, 10),
    isPM
  };
}

function calculateTimeDifferenceInMinutes(
  startHours: number,
  startMinutes: number,
  startIsPM: boolean,
  endHours: number,
  endMinutes: number,
  endIsPM: boolean
) {
  // Convertir a formato 24 horas
  let start24Hours = startHours;
  let end24Hours = endHours;
  
  if (startIsPM && startHours < 12) start24Hours += 12;
  if (!startIsPM && startHours === 12) start24Hours = 0;
  
  if (endIsPM && endHours < 12) end24Hours += 12;
  if (!endIsPM && endHours === 12) end24Hours = 0;
  
  // Calcular diferencia en minutos
  const startTotalMinutes = start24Hours * 60 + startMinutes;
  let endTotalMinutes = end24Hours * 60 + endMinutes;
  
  // Si el tiempo de llegada es anterior al de salida, asumir que es al día siguiente
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60; // Añadir 24 horas
  }
  
  return endTotalMinutes - startTotalMinutes;
}

function addMinutesToTime(hours: number, minutes: number, isPM: boolean, additionalMinutes: number) {
  // Convertir a formato 24 horas para cálculos
  let hours24 = hours;
  if (isPM && hours < 12) hours24 += 12;
  if (!isPM && hours === 12) hours24 = 0;
  
  // Añadir minutos
  let totalMinutes = hours24 * 60 + minutes + additionalMinutes;
  
  // Normalizar
  while (totalMinutes >= 24 * 60) {
    totalMinutes -= 24 * 60; // Restar un día completo
  }
  
  // Convertir de vuelta a formato 12 horas
  const newHours24 = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  let newHours12 = newHours24;
  let newIsPM = newHours24 >= 12;
  
  if (newHours24 > 12) newHours12 = newHours24 - 12;
  if (newHours24 === 0) newHours12 = 12;
  
  return {
    hours: newHours12,
    minutes: newMinutes,
    isPM: newIsPM
  };
}

function formatTime(hours: number, minutes: number, isPM: boolean) {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}