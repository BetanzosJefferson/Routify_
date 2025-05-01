import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, addDays, eachDayOfInterval, parseISO, startOfDay, endOfDay, isEqual, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { RouteWithSegments, SegmentPrice } from "@shared/schema";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convierte cualquier formato de fecha a un objeto Date en el inicio del día en hora local
 * preservando correctamente la zona horaria
 * @param date - Fecha en formato Date o string
 * @returns Objeto Date normalizado al inicio del día
 */
export function normalizeToStartOfDay(date: Date | string): Date {
  // Si es string, primero convertir a Date
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Si es formato ISO o tiene 'T', usar parseISO pero asegurarnos que sea tratado como UTC
    if (date.includes('T')) {
      // Parsear como ISO pero luego extraer solo año, mes, día en zona horaria local
      const parsedDate = parseISO(date);
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth(); // 0-11
      const day = parsedDate.getDate();
      
      // Crear nueva fecha local con estos componentes y hora 12 para evitar problemas de DST
      dateObj = new Date(year, month, day, 12, 0, 0);
    } else {
      // Si es formato YYYY-MM-DD simple
      const parts = date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Meses en JS son 0-11
        const day = parseInt(parts[2], 10);
        
        // Crear fecha con hora 12 para evitar problemas de cambio de día por zona horaria
        dateObj = new Date(year, month, day, 12, 0, 0);
      } else {
        // Para otros formatos, asumimos que está en zona horaria local
        const tempDate = new Date(date);
        dateObj = new Date(
          tempDate.getFullYear(),
          tempDate.getMonth(),
          tempDate.getDate(),
          12, 0, 0
        );
      }
    }
  } else {
    // Si ya es un objeto Date, extraer sus componentes y crear nueva fecha
    // con hora a mediodía para evitar problemas de cambio de día
    dateObj = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12, 0, 0
    );
  }
  
  // Retornar fecha normalizada sin aplicar startOfDay que podría cambiar la fecha
  return dateObj;
}

/**
 * Convierte cualquier formato de fecha a un objeto Date al final del día en hora local
 * @param date - Fecha en formato Date o string
 * @returns Objeto Date normalizado al final del día
 */
export function normalizeToEndOfDay(date: Date | string): Date {
  return endOfDay(normalizeToStartOfDay(date));
}

/**
 * Compara si dos fechas representan el mismo día, independientemente de la hora
 * @param dateA - Primera fecha a comparar
 * @param dateB - Segunda fecha a comparar
 * @returns true si ambas fechas representan el mismo día
 */
export function isSameLocalDay(dateA: Date | string, dateB: Date | string): boolean {
  const normalizedA = normalizeToStartOfDay(dateA);
  const normalizedB = normalizeToStartOfDay(dateB);
  return isEqual(normalizedA, normalizedB);
}

/**
 * Formatea una fecha para mostrarla al usuario
 * @param date - Fecha a formatear
 * @returns Fecha formateada como string
 */
export function formatDate(date: Date | string): string {
  const normalizedDate = normalizeToStartOfDay(date);
  return format(normalizedDate, 'MMMM dd, yyyy', { locale: es });
}

/**
 * Formatea una fecha para usarla en inputs HTML de tipo date (formato YYYY-MM-DD)
 * @param date - Fecha a formatear
 * @returns String en formato YYYY-MM-DD
 */
export function formatDateForInput(date: Date | string): string {
  const normalizedDate = normalizeToStartOfDay(date);
  return dateToLocalISOString(normalizedDate);
}

export function formatTime(time: string): string {
  return time;
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return '$0 MXN';
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(price);
}

export function generateTripsForDateRange(
  startDateStr: string, 
  endDateStr: string
): Date[] {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  return eachDayOfInterval({
    start: startDate,
    end: endDate
  });
}

export function convertTo24Hour(
  hour: string, 
  minute: string, 
  ampm: string
): string {
  let hourNum = parseInt(hour, 10);
  
  if (ampm === "PM" && hourNum < 12) {
    hourNum += 12;
  } else if (ampm === "AM" && hourNum === 12) {
    hourNum = 0;
  }
  
  return `${hourNum.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function convertTo12Hour(time24: string): { 
  hour: string; 
  minute: string; 
  ampm: string; 
} {
  const [hour24, minute] = time24.split(':');
  let hour = parseInt(hour24, 10);
  let ampm = "AM";
  
  if (hour >= 12) {
    ampm = "PM";
    if (hour > 12) {
      hour -= 12;
    }
  } else if (hour === 0) {
    hour = 12;
  }
  
  return {
    hour: hour.toString(),
    minute,
    ampm
  };
}

export function generateSegmentsFromRoute(route: RouteWithSegments): SegmentPrice[] {
  const segments: SegmentPrice[] = [];
  
  // Add origin to first stop
  if (route.stops.length > 0) {
    segments.push({
      origin: route.origin,
      destination: route.stops[0],
      price: 0
    });
    
    // Add stop to stop segments
    for (let i = 0; i < route.stops.length - 1; i++) {
      segments.push({
        origin: route.stops[i],
        destination: route.stops[i + 1],
        price: 0
      });
    }
    
    // Add last stop to destination
    segments.push({
      origin: route.stops[route.stops.length - 1],
      destination: route.destination,
      price: 0
    });
  } else {
    // Direct route with no stops
    segments.push({
      origin: route.origin,
      destination: route.destination,
      price: 0
    });
  }
  
  return segments;
}

export function generateReservationId(id: number): string {
  return `RES${id}`;
}

export function isSameCity(location1: string, location2: string): boolean {
  // Extract city name (assuming format "City - Location")
  const city1 = location1.split(' - ')[0].trim();
  const city2 = location2.split(' - ')[0].trim();
  
  return city1 === city2;
}

/**
 * Convierte un objeto Date a una cadena ISO para ser usada en inputs tipo date YYYY-MM-DD
 * Este método está diseñado para evitar los problemas de zona horaria
 * @param date - Fecha a convertir 
 * @returns Cadena en formato ISO YYYY-MM-DD
 */
export function dateToLocalISOString(date: Date): string {
  // Extraer componentes de fecha en hora local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // los meses son 0-indexados
  const day = String(date.getDate()).padStart(2, '0');
  
  // Retornar en formato YYYY-MM-DD
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una fecha para su uso en filtros de API de manera segura con zonas horarias
 * @param date - Fecha a formatear
 * @returns Cadena de fecha en formato ISO para uso en consultas
 */
export function formatDateForApiQuery(date: Date | string): string {
  const normalizedDate = normalizeToStartOfDay(date);
  return dateToLocalISOString(normalizedDate);
}

/**
 * Crea un objeto Date a partir de una cadena YYYY-MM-DD respetando la zona horaria local
 * @param dateString - Cadena de fecha en formato YYYY-MM-DD
 * @returns Objeto Date 
 */
export function createLocalDateFromString(dateString: string): Date {
  if (!dateString) return new Date();
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Crear fecha a mediodía para evitar problemas con cambios de día por zona horaria
  return new Date(year, month - 1, day, 12, 0, 0);
}
