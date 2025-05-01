import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, addDays, eachDayOfInterval } from "date-fns";
import { RouteWithSegments, SegmentPrice } from "@shared/schema";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    // Crear fecha a partir de componentes individuales para evitar problemas de zona horaria
    const parts = date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Meses en JS son 0-11
      const day = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      date = new Date(date);
    }
  }
  return format(date, 'MMMM dd, yyyy');
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
