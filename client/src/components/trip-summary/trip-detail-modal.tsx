import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TripWithRouteInfo, Reservation, Passenger } from "@shared/schema";
import { X } from "lucide-react";
import { formatTripTime } from "@/lib/trip-utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type Expense = {
  id: number | string;
  tripId: number;
  amount: number;
  category: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: number | null;
};

type ReservationWithPassengers = Reservation & {
  passengers: Passenger[];
  trip: TripWithRouteInfo;
  createdByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  checkedByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  paidBy?: number;
  paidAt?: string | Date;
  paidByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
};

type TripDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trip: TripWithRouteInfo | undefined;
  expenses: Expense[];
  reservations: ReservationWithPassengers[];
  budget: number;
  totalSales: number;
};

export default function TripDetailModal({
  isOpen,
  onClose,
  trip,
  expenses,
  reservations,
  budget,
  totalSales
}: TripDetailModalProps) {
  if (!trip) return null;

  // Calcular estadísticas del viaje
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const tripProfit = totalSales - totalExpenses;
  const totalPassengers = reservations.reduce((sum, res) => sum + res.passengers.length, 0);

  // Formatear fecha para mostrar
  const formatDate = (date: Date) => {
    return format(new Date(date), "EEEE d 'de' MMMM, yyyy", { locale: es });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles del Viaje</DialogTitle>
          <DialogDescription>
            Información completa del viaje y sus pasajeros
          </DialogDescription>
        </DialogHeader>
        <button 
          onClick={() => onClose()} 
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </button>
        
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Información del Viaje</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-medium text-gray-700">Ruta:</span> 
                  <span className="ml-2">{trip.route?.origin} - {trip.route?.destination}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Fecha:</span> 
                  <span className="ml-2">{formatDate(trip.departureDate)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Horario:</span> 
                  <span className="ml-2">{formatTripTime(trip.departureTime)} - {formatTripTime(trip.arrivalTime)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Vehículo:</span> 
                  <span className="ml-2">{trip.vehicleId ? `#${trip.vehicleId}` : 'Sin asignar'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Operador:</span> 
                  <span className="ml-2">{trip.driverId ? `#${trip.driverId}` : 'Sin asignar'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Capacidad:</span> 
                  <span className="ml-2">{trip.capacity} asientos</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ocupación:</span> 
                  <span className="ml-2">{totalPassengers} / {trip.capacity} pasajeros</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Información Financiera</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-medium text-gray-700">Presupuesto:</span> 
                  <span className="ml-2">${budget.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ventas totales:</span> 
                  <span className="ml-2 text-green-600 font-semibold">${totalSales.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Gastos totales:</span> 
                  <span className="ml-2 text-red-600 font-semibold">${totalExpenses.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Ganancia:</span> 
                  <span className={`ml-2 font-semibold ${
                    tripProfit > 0 ? 'text-green-600' : tripProfit < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>${tripProfit.toFixed(2)}</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold mt-6 mb-4">Gastos</h3>
              {expenses.length > 0 ? (
                <div className="space-y-2">
                  {expenses.map(expense => (
                    <div key={expense.id} className="flex justify-between p-2 border-b">
                      <div>
                        <Badge variant={
                          expense.category === 'Combustible' ? 'default' :
                          expense.category === 'Casetas' ? 'secondary' :
                          expense.category === 'Alimentos' ? 'outline' : 'destructive'
                        }>
                          {expense.category}
                        </Badge>
                        <p className="text-sm text-gray-600">{expense.description || 'Sin descripción'}</p>
                      </div>
                      <span className="font-medium">${expense.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No hay gastos registrados</p>
              )}
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <h3 className="text-lg font-semibold mb-4">Lista de Pasajeros</h3>
          {reservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Contacto</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reservations.map(reservation => (
                    <tr key={reservation.id} className="bg-white">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">
                          {reservation.passengers.map(p => `${p.firstName} ${p.lastName}`).join(', ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          Reserva #{reservation.id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {reservation.phone || 'Sin teléfono'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {reservation.email || 'Sin correo'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={reservation.status === 'confirmada' ? 'default' : 'outline'}>
                          {reservation.status === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={
                          reservation.paymentStatus === 'pagado' ? 'success' : 
                          reservation.paymentStatus === 'parcial' ? 'warning' : 'destructive'
                        }>
                          {reservation.paymentStatus === 'pagado' ? 'Pagado' : 
                           reservation.paymentStatus === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {reservation.paymentMethod || 'Sin método'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No hay pasajeros registrados para este viaje
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}