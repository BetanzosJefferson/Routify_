import { UserRole } from "@shared/schema";

export interface Section {
  id: string;
  name: string;
  description?: string;
}

// Definición de todas las secciones de la aplicación
export const ALL_SECTIONS: Section[] = [
  { id: "dashboard", name: "Panel Principal", description: "Resumen general del sistema" },
  { id: "routes", name: "Rutas", description: "Gestión de rutas de transporte" },
  { id: "trips", name: "Viajes", description: "Lista de viajes programados" },
  { id: "publish-trip", name: "Publicar Viaje", description: "Crear y publicar nuevos viajes" },
  { id: "reservations", name: "Reservaciones", description: "Gestión de reservaciones de pasajeros" },
  { id: "trip-summary", name: "Resumen de Viajes", description: "Reportes y estadísticas de viajes" },
  { id: "boarding-list", name: "Lista de Abordaje", description: "Control de abordaje de pasajeros" },
  { id: "users", name: "Usuarios", description: "Gestión de usuarios del sistema" },
  { id: "vehicles", name: "Unidades", description: "Gestión de vehículos y flota" },
  { id: "commissions", name: "Comisiones", description: "Configuración de comisiones" },
  { id: "settings", name: "Configuración", description: "Ajustes generales del sistema" }
];

// Mapa de permisos por rol
export const ROLE_SECTION_PERMISSIONS: Record<string, string[]> = {
  [UserRole.SUPER_ADMIN]: ALL_SECTIONS.map(section => section.id), // Acceso total
  [UserRole.ADMIN]: ALL_SECTIONS.map(section => section.id), // Acceso total
  [UserRole.OWNER]: [
    "routes",
    "trips",
    "publish-trip",
    "reservations",
    "trip-summary",
    "boarding-list",
    "users",
    "vehicles"
  ],
  [UserRole.CALL_CENTER]: [
    "trips",
    "reservations",
    "boarding-list"
  ],
  [UserRole.CHECKER]: [
    "boarding-list" 
  ],
  // Permisos para rol DRIVER (conductor) - ya incluye el alias español 'chofer'
  [UserRole.DRIVER]: [
    "dashboard",
    "boarding-list"
    // Quitamos acceso a "trips" y "reservations" para conductor
  ],
  [UserRole.TICKET_OFFICE]: [
    "trips",
    "reservations"
  ],
  [UserRole.DEVELOPER]: ALL_SECTIONS.map(section => section.id) // Acceso total para desarrollo
};

// Función para verificar si un usuario tiene acceso a una sección
export function hasAccessToSection(userRole: string, sectionId: string): boolean {
  if (!userRole || !sectionId) return false;
  
  const allowedSections = ROLE_SECTION_PERMISSIONS[userRole] || [];
  return allowedSections.includes(sectionId);
}

// Función para obtener todas las secciones permitidas para un rol
export function getAllowedSections(userRole: string): Section[] {
  if (!userRole) return [];
  
  const allowedSectionIds = ROLE_SECTION_PERMISSIONS[userRole] || [];
  return ALL_SECTIONS.filter(section => allowedSectionIds.includes(section.id));
}