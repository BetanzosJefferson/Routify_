-- ======================================================
-- ESTRUCTURA COMPLETA DE LA BASE DE DATOS - TRANSROUTE
-- Sistema de Gestión de Transporte y Logística
-- Generado el: 2025-05-28
-- ======================================================

-- TABLA: users (Usuarios del sistema)
-- Roles: superAdmin, admin, checador, chofer, taquilla, dueño, comisionista, call center
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'taquilla',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    company TEXT DEFAULT '',
    profile_picture TEXT DEFAULT '',
    invited_by_id INTEGER REFERENCES users(id),
    company_id TEXT DEFAULT '',
    commission_percentage DOUBLE PRECISION DEFAULT 0
);

-- TABLA: companies (Empresas de transporte)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    identifier TEXT NOT NULL,
    logo TEXT DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    created_by INTEGER REFERENCES users(id)
);

-- TABLA: user_companies (Relación usuarios-empresas para acceso multi-empresa)
CREATE TABLE user_companies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id TEXT NOT NULL REFERENCES companies(identifier),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- TABLA: routes (Rutas de transporte)
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    origin TEXT NOT NULL,
    stops TEXT[] NOT NULL,
    destination TEXT NOT NULL,
    company_id TEXT
);

-- TABLA: vehicles (Vehículos de la flota)
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    plates TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    economic_number TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    has_ac BOOLEAN DEFAULT false,
    has_reclining_seats BOOLEAN DEFAULT false,
    services TEXT[],
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    company_id TEXT
);

-- TABLA: trips (Viajes programados)
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id),
    departure_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    price DOUBLE PRECISION DEFAULT 0,
    vehicle_type TEXT,
    segment_prices JSON NOT NULL,
    is_sub_trip BOOLEAN DEFAULT false,
    parent_trip_id INTEGER,
    segment_origin TEXT,
    segment_destination TEXT,
    company_id TEXT,
    vehicle_id INTEGER,
    driver_id INTEGER,
    visibility TEXT DEFAULT 'publicado',
    trip_status TEXT DEFAULT 'aun_no_inicia'
);

-- TABLA: reservations (Reservaciones de pasajeros)
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    payment_method TEXT NOT NULL DEFAULT 'efectivo',
    company_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pendiente',
    advance_amount DOUBLE PRECISION DEFAULT 0,
    advance_payment_method TEXT DEFAULT 'efectivo',
    created_by INTEGER,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    commission_paid BOOLEAN DEFAULT false,
    checked_by INTEGER,
    checked_at TIMESTAMP WITHOUT TIME ZONE,
    check_count INTEGER DEFAULT 0,
    paid_by INTEGER,
    marked_as_paid_at TIMESTAMP WITHOUT TIME ZONE,
    coupon_code TEXT,
    discount_amount DOUBLE PRECISION DEFAULT 0,
    original_amount DOUBLE PRECISION
);

-- TABLA: passengers (Pasajeros de las reservaciones)
CREATE TABLE passengers (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    reservation_id INTEGER NOT NULL
);

-- TABLA: reservation_requests (Solicitudes de reservación pendientes)
CREATE TABLE reservation_requests (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL,
    passengers_data JSONB NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pendiente',
    advance_amount DOUBLE PRECISION DEFAULT 0,
    advance_payment_method TEXT DEFAULT 'efectivo',
    payment_method TEXT NOT NULL DEFAULT 'efectivo',
    notes TEXT,
    requester_id INTEGER NOT NULL,
    company_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    reviewed_by INTEGER,
    review_notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- TABLA: packages (Paquetería y encomiendas)
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id),
    sender_name TEXT NOT NULL,
    sender_lastname TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_lastname TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    package_description TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    payment_method TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    created_by INTEGER REFERENCES users(id),
    company_id TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'pendiente',
    delivered_at TIMESTAMP WITHOUT TIME ZONE,
    uses_seats BOOLEAN NOT NULL DEFAULT false,
    seats_quantity INTEGER DEFAULT 0,
    paid_by INTEGER,
    delivered_by INTEGER
);

-- TABLA: commissions (Comisiones por ventas)
CREATE TABLE commissions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    amount DOUBLE PRECISION NOT NULL,
    percentage BOOLEAN DEFAULT false,
    trip_id INTEGER REFERENCES trips(id),
    route_id INTEGER REFERENCES routes(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    company_id TEXT
);

-- TABLA: notifications (Notificaciones del sistema)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    meta_data TEXT
);

-- TABLA: coupons (Cupones de descuento)
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    usage_limit INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0,
    expiration_hours INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    company_id TEXT
);

-- TABLA: invitations (Invitaciones de usuarios)
CREATE TABLE invitations (
    id SERIAL PRIMARY KEY,
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    used_at TIMESTAMP WITHOUT TIME ZONE,
    created_by_id INTEGER NOT NULL,
    metadata JSON
);

-- TABLA: location_data (Datos de ubicaciones geográficas)
CREATE TABLE location_data (
    id SERIAL PRIMARY KEY,
    state TEXT NOT NULL,
    code TEXT NOT NULL,
    municipalities JSONB NOT NULL
);

-- TABLA: trip_budgets (Presupuestos de viajes)
CREATE TABLE trip_budgets (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id),
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    company_id TEXT
);

-- TABLA: trip_expenses (Gastos de viajes)
CREATE TABLE trip_expenses (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id),
    type TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    company_id TEXT,
    user_id INTEGER REFERENCES users(id),
    created_by TEXT
);

-- TABLA: box_cutoff (Cortes de caja)
CREATE TABLE box_cutoff (
    id SERIAL PRIMARY KEY,
    fecha_inicio TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    total_ingresos NUMERIC NOT NULL DEFAULT 0,
    total_efectivo NUMERIC NOT NULL DEFAULT 0,
    total_transferencias NUMERIC NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    company_id TEXT
);

-- TABLA: transactions (Transacciones financieras)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    details JSONB NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    cutoff_id INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    company_id TEXT
);

-- ======================================================
-- RELACIONES Y RESTRICCIONES PRINCIPALES
-- ======================================================

-- Relaciones principales:
-- 1. users -> companies (a través de user_companies para acceso multi-empresa)
-- 2. routes -> trips (una ruta puede tener múltiples viajes)
-- 3. trips -> reservations (un viaje puede tener múltiples reservaciones)
-- 4. reservations -> passengers (una reservación puede tener múltiples pasajeros)
-- 5. trips -> packages (un viaje puede llevar múltiples paquetes)
-- 6. users -> notifications (un usuario puede tener múltiples notificaciones)
-- 7. trips -> vehicles (un viaje puede usar un vehículo específico)
-- 8. trips -> users (conductor asignado al viaje)

-- ======================================================
-- ÍNDICES RECOMENDADOS PARA RENDIMIENTO
-- ======================================================

-- Para optimizar consultas frecuentes:
-- CREATE INDEX idx_reservations_trip_id ON reservations(trip_id);
-- CREATE INDEX idx_reservations_company_id ON reservations(company_id);
-- CREATE INDEX idx_reservations_created_at ON reservations(created_at);
-- CREATE INDEX idx_trips_departure_date ON trips(departure_date);
-- CREATE INDEX idx_trips_company_id ON trips(company_id);
-- CREATE INDEX idx_passengers_reservation_id ON passengers(reservation_id);
-- CREATE INDEX idx_packages_trip_id ON packages(trip_id);
-- CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
-- CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);

-- ======================================================
-- ROLES Y PERMISOS DEL SISTEMA
-- ======================================================

-- ROLES DISPONIBLES:
-- - superAdmin: Acceso completo al sistema
-- - admin: Administrador de empresa
-- - dueño: Propietario de empresa
-- - taquilla: Venta de boletos (puede acceder a múltiples empresas)
-- - checador: Verificación de boletos
-- - chofer: Conductor de vehículos
-- - comisionista: Vendedor con comisiones
-- - call center: Centro de llamadas
-- - desarrollador: Desarrollador del sistema

-- ======================================================
-- CARACTERÍSTICAS PRINCIPALES DEL SISTEMA
-- ======================================================

-- 1. GESTIÓN MULTI-EMPRESA:
--    - Una instalación puede manejar múltiples empresas de transporte
--    - Usuarios pueden tener acceso a múltiples empresas (especialmente taquilla)
--    - Aislamiento de datos por empresa

-- 2. GESTIÓN DE VIAJES:
--    - Rutas con múltiples paradas
--    - Sub-viajes para rutas con conexiones
--    - Precios por segmentos
--    - Control de asientos disponibles

-- 3. RESERVACIONES:
--    - Múltiples pasajeros por reservación
--    - Diferentes métodos de pago
--    - Sistema de anticipos
--    - Control de estado (confirmado, cancelado, etc.)

-- 4. PAQUETERÍA:
--    - Envío de encomiendas en los viajes
--    - Control de entrega
--    - Puede usar asientos del vehículo

-- 5. SISTEMA FINANCIERO:
--    - Comisiones por ventas
--    - Cortes de caja
--    - Transacciones detalladas
--    - Cupones de descuento

-- 6. NOTIFICACIONES:
--    - Sistema de notificaciones en tiempo real
--    - WebSocket para actualizaciones instantáneas

-- 7. OPTIMIZACIONES DE RENDIMIENTO:
--    - Consultas batch para reducir carga en BD
--    - Cache temporal para evitar consultas duplicadas
--    - Filtrado por fecha para carga inicial rápida

-- ======================================================
-- NOTAS DE DESARROLLO
-- ======================================================

-- Este sistema fue desarrollado con:
-- - Backend: Node.js + Express.js + TypeScript
-- - Frontend: React.js + TypeScript + Tailwind CSS
-- - Base de datos: PostgreSQL + Drizzle ORM
-- - Autenticación: Sesiones con passport-local
-- - Real-time: WebSocket para actualizaciones en tiempo real

-- El sistema maneja roles específicos con permisos diferenciados y
-- está optimizado para el manejo de grandes volúmenes de reservaciones
-- con tiempos de respuesta rápidos.