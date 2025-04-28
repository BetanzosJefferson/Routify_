import ExcelJS from 'exceljs';
import { Reservation } from '@shared/schema';
import { storage } from './storage';

// Interfaz para la información del pasajero con datos adicionales
export interface PassengerBoardingInfo extends Reservation {
  passengerNames: string;
  origin: string;
  destination: string;
  departureDate: Date;
  departureTime: string;
  checkedByUser?: {
    firstName: string;
    lastName: string;
  };
  chargedByUser?: {
    firstName: string;
    lastName: string;
  };
}

export async function generateBoardingListExcel(tripId: number, reservations: PassengerBoardingInfo[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Lista de Abordaje');

  // Configurar encabezados con estilos
  worksheet.columns = [
    { header: 'Código', key: 'code', width: 12 },
    { header: 'Pasajero(s)', key: 'passengers', width: 25 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Teléfono', key: 'phone', width: 15 },
    { header: 'Origen', key: 'origin', width: 20 },
    { header: 'Destino', key: 'destination', width: 20 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Hora', key: 'time', width: 10 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Anticipo', key: 'advance', width: 10 },
    { header: 'Estado de Pago', key: 'paymentStatus', width: 15 },
    { header: 'Estado de Verificación', key: 'checkStatus', width: 15 },
    { header: 'Verificado por', key: 'checkedBy', width: 20 },
    { header: 'Fecha de Verificación', key: 'checkedAt', width: 20 },
    { header: 'Cobrado por', key: 'chargedBy', width: 20 },
    { header: 'Notas', key: 'notes', width: 30 },
  ];

  // Estilo para los encabezados
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Formatear fecha
  const formatDate = (date: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Formatear hora
  const formatTime = (time: string) => {
    return time || '';
  };

  // Formatear estado de pago
  const formatPaymentStatus = (status: string) => {
    if (status === 'pagado') return 'Pagado';
    if (status === 'pendiente') return 'Pendiente';
    if (status === 'cancelado') return 'Cancelado';
    return status;
  };

  // Formatear estado de verificación
  const formatCheckStatus = (status: string) => {
    if (status === 'check') return 'Verificado';
    if (status === 'no_check') return 'No verificado';
    return status;
  };

  // Formatear estado de cobro
  const formatChargeStatus = (status: string) => {
    if (status === 'cobrado') return 'Cobrado';
    if (status === 'pendiente_cobro') return 'Pendiente de cobro';
    if (status === 'cancelado') return 'Cancelado';
    return status;
  };

  // Generar código de reservación
  const generateReservationCode = (id: number) => {
    return `RES${id.toString().padStart(5, '0')}`;
  };

  // Agregar datos
  for (const reservation of reservations) {
    worksheet.addRow({
      code: generateReservationCode(reservation.id),
      passengers: reservation.passengerNames,
      email: reservation.email,
      phone: reservation.phone,
      origin: reservation.origin,
      destination: reservation.destination,
      date: formatDate(reservation.departureDate),
      time: formatTime(reservation.departureTime),
      total: reservation.totalAmount,
      advance: reservation.advanceAmount || 0,
      paymentStatus: formatPaymentStatus(reservation.paymentStatus),
      checkStatus: formatCheckStatus(reservation.checkStatus),
      checkedBy: reservation.checkedByUser ? 
        `${reservation.checkedByUser.firstName} ${reservation.checkedByUser.lastName}` : 
        '',
      checkedAt: reservation.checkedAt ? formatDate(new Date(reservation.checkedAt)) : '',
      chargedBy: reservation.chargedByUser ? 
        `${reservation.chargedByUser.firstName} ${reservation.chargedByUser.lastName}` : 
        '',
      notes: reservation.notes || '',
    });
  }

  // Ajustar estilos de las celdas de datos
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header row
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });

  // Congelar la primera fila (encabezados)
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
  ];

  // Exportar a buffer
  return await workbook.xlsx.writeBuffer();
}

// Función para obtener información detallada para una lista de abordaje por viaje
export async function getBoardingListData(tripId: number): Promise<PassengerBoardingInfo[]> {
  try {
    // Obtener reservaciones para este viaje
    const reservations = await storage.getReservationsForTrip(tripId);
    
    if (!reservations.length) {
      console.log(`No se encontraron reservaciones para el viaje ${tripId}`);
      return [];
    }
    
    // Obtener información del viaje
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      console.log(`No se encontró el viaje ${tripId}`);
      return [];
    }
    
    // Obtener información de la ruta
    const route = await storage.getRoute(trip.routeId);
    if (!route) {
      console.log(`No se encontró la ruta ${trip.routeId}`);
      return [];
    }

    // Obtener información de los usuarios que verificaron o cobraron 
    const userIds = reservations
      .flatMap(r => [r.checkedBy, r.createdBy])
      .filter(id => id !== undefined && id !== null);
    
    // Crear un mapa de usuarios usando un Set para eliminar duplicados
    const uniqueUserIds = [...new Set(userIds)] as number[];
    const usersMap = new Map();
    
    // Cargar usuarios desde la base de datos y guardarlos en el mapa
    for (const userId of uniqueUserIds) {
      const user = await storage.getUser(userId);
      if (user) {
        usersMap.set(userId, user);
      }
    }
    
    // Enriquecer las reservaciones con información adicional
    const enhancedReservations: PassengerBoardingInfo[] = reservations.map(reservation => {
      // Obtener información de pasajeros
      const passengerNames = reservation.passengers
        ? reservation.passengers.map(p => `${p.firstName} ${p.lastName}`).join(', ')
        : 'No hay pasajeros';
        
      // Obtener origen y destino específico del viaje
      const origin = trip.segmentOrigin || route.origin;
      const destination = trip.segmentDestination || route.destination;
      
      // Obtener información de quien verificó el boleto
      const checkedByUser = reservation.checkedBy ? usersMap.get(reservation.checkedBy) : undefined;
      
      // Obtener información de quien lo creó (asumimos que es quien lo cobró)
      const chargedByUser = reservation.createdBy ? usersMap.get(reservation.createdBy) : undefined;
      
      return {
        ...reservation,
        passengerNames,
        origin,
        destination,
        departureDate: trip.departureDate,
        departureTime: trip.departureTime,
        checkedByUser,
        chargedByUser
      };
    });
    
    return enhancedReservations;
  } catch (error) {
    console.error('Error al obtener datos para la lista de abordaje:', error);
    throw error;
  }
}