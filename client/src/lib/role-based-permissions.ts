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
  { id: "my-commissions", name: "Mis Comisiones", description: "Historial de comisiones personales" },
  { id: "reservation-requests", name: "Solicitudes", description: "Gestión de solicitudes de reservación" },
  { id: "notifications", name: "Notificaciones", description: "Centro de notificaciones del sistema" },
  { id: "coupons", name: "Cupones", description: "Gestión de cupones de descuento" },
  { id: "packages", name: "Paqueterías", description: "Gestión de envío de paquetes" },
  { id: "cash-register", name: "Caja", description: "Registro de pagos realizados" },
  { id: "cash-box", name: "Caja", description: "Gestión de transacciones en caja" },
  { id: "cutoff-history", name: "Historial de Cortes", description: "Historial de cortes de caja realizados" },
  /* Temporalmente deshabilitado
  { id: "passenger-transfer", name: "Transferencia de pasajeros", description: "Gestión de transferencias de pasajeros entre viajes" },
  */
  { id: "settings", name: "Configuración", description: "Ajustes generales del sistema" },
  { id: "user-cash-boxes", name: "Cajas de usuarios", description: "Gestión de cajas individuales de usuarios" }
];

// Mapa de permisos por rol
export const ROLE_SECTION_PERMISSIONS: Record<string, string[]> = {
  [UserRole.SUPER_ADMIN]: ALL_SECTIONS.map(section => section.id), // Acceso total
  [UserRole.DEVELOPER]: ALL_SECTIONS.map(section => section.id), // Acceso total para desarrollo
  [UserRole.OWNER]: [
    "routes",
    "trips",
    "publish-trip",
    "reservations",
    "trip-summary",
    "boarding-list",
    "users",
    "vehicles",
    "commissions",
    "reservation-requests",
    "notifications",
    "coupons",
    "packages",
    "cash-register",
    "cash-box",
    "cutoff-history",
    "passenger-transfer",
    "user-cash-boxes"
  ],
  [UserRole.ADMIN]: [
    "routes",
    "trips",
    "publish-trip",
    "reservations",
    "trip-summary",
    "boarding-list",
    "users",
    "vehicles",
    "commissions",
    "reservation-requests", 
    "notifications",
    "packages",
    "cash-register",
    "cash-box",
    "cutoff-history",
    "passenger-transfer",
    "user-cash-boxes"
  ],
  [UserRole.CALL_CENTER]: [
    "trips",
    "reservations",
    "boarding-list",
    "reservation-requests",
    "notifications",
    "packages",
    "cash-box",
    "cutoff-history"
  ],
  [UserRole.CHECKER]: [
    "trips",
    "boarding-list",
    "notifications",
    "packages",
    "cash-register",
    "cash-box",
    "cutoff-history"
  ],
  // Permisos para rol DRIVER (conductor) - ya incluye el alias español 'chofer'
  [UserRole.DRIVER]: [
    "dashboard",
    "boarding-list",
    "notifications",
    "packages",
    "cash-register",
    "cash-box",
    "cutoff-history"
    // Quitamos acceso a "trips" y "reservations" para conductor
  ],
  [UserRole.TICKET_OFFICE]: [
    "trips",
    "reservations",
    "notifications",
    "packages",
    "cash-register",
    "cash-box",
    "cutoff-history"
  ],
  // Permisos para el nuevo rol COMISIONISTA
  [UserRole.COMMISSIONER]: [
    "trips",
    "my-commissions",
    "reservation-requests",
    "notifications",
    "cash-box",
    "cutoff-history"
  ]
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

/**
 * Comprueba si un rol de usuario tiene acceso a las funciones reservadas para ciertos roles
 * @param userRole - Rol del usuario actual
 * @param allowedRoles - Array de roles que tienen acceso
 * @returns Verdadero si el usuario tiene acceso, falso en caso contrario
 */
export function hasRoleAccess(userRole: string, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Comprueba si un usuario tiene alguno de los roles requeridos
 * @param user - Usuario actual
 * @param requiredRoles - Array de roles permitidos
 * @returns Verdadero si el usuario tiene alguno de los roles requeridos
 */
export function hasRequiredRole(user: any, requiredRoles: string[]): boolean {
  if (!user || !user.role) return false;
  
  // Mapeo de alias en español a los roles estándar en inglés
  const roleMap: Record<string, string> = {
    'admin': 'admin',
    'administrador': 'admin',
    'owner': 'owner',
    'dueño': 'owner',
    'checker': 'checker',
    'checador': 'checker',
    'driver': 'driver',
    'chofer': 'driver',
    'ticket_office': 'ticket_office',
    'taquilla': 'ticket_office',
    'super_admin': 'super_admin',
    'superadmin': 'super_admin',
    'desarrollador': 'developer',
    'developer': 'developer',
    'call_center': 'call_center',
    'commissioner': 'commissioner',
    'comisionista': 'commissioner',
  };
  
  // Normalizar el rol del usuario
  const normalizedUserRole = roleMap[user.role.toLowerCase()] || user.role.toLowerCase();
  
  // Normalizar los roles requeridos
  const normalizedRequiredRoles = requiredRoles.map(role => 
    roleMap[role.toLowerCase()] || role.toLowerCase()
  );
  
  return normalizedRequiredRoles.includes(normalizedUserRole);
}