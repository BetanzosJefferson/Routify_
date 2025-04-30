import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  UserIcon,
  SearchIcon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
} from "lucide-react";
import { ReservationWithDetails, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export default function CommissionReservationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { user } = useAuth();

  const { data: reservations = [], isLoading } = useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations"],
    enabled: !!user,
  });

  // Filtrar reservaciones creadas solo por usuarios con rol COMISIONISTA
  const commissionerReservations = reservations.filter(reservation => {
    console.log(`Reservación ${reservation.id} creada por: ${reservation.createdByUser?.role}`);
    return reservation.createdByUser?.role === UserRole.COMMISSIONER;
  });

  // Aplicar filtros adicionales
  const filteredReservations = commissionerReservations.filter(reservation => {
    // Filtro por término de búsqueda (nombre de pasajero, email o teléfono)
    const searchMatch = 
      !searchTerm || 
      reservation.passengers?.some(
        p => 
          p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      reservation.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por fecha
    const dateMatch = 
      !selectedDate || 
      (selectedDate && 
        new Date(reservation.trip.departureDate).toDateString() === 
        selectedDate.toDateString());
    
    return searchMatch && dateMatch;
  });

  // Formatear fecha para mostrar
  const formatTripDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "EEE d 'de' MMMM, yyyy", { locale: es });
  };

  // Formatear precio
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  // Generar ID de reservación formateado
  const generateReservationId = (id: number) => {
    return id.toString().padStart(6, '0');
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2">
          <div className="text-primary">
            <FileTextIcon className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Comisiones - Reservaciones</h1>
        </div>
        <p className="text-muted-foreground">Reservaciones creadas por comisionistas</p>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle>Reservaciones por Comisionistas</CardTitle>
          <CardDescription>
            Listado de todas las reservaciones creadas por comisionistas.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="search" className="text-xs text-gray-500">Buscar</Label>
              <div className="relative">
                <SearchIcon className="h-4 w-4 absolute left-2.5 top-3 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Buscar por nombre, email o teléfono..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="date-filter" className="text-xs text-gray-500">Filtrar por fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date: Date | undefined) => setSelectedDate(date || null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDate(null);
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
          
          {/* Tabla de reservaciones */}
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : filteredReservations.length > 0 ? (
            <div className="overflow-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Pasajero</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado por</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation) => (
                    <TableRow key={reservation.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        #{generateReservationId(reservation.id)}
                      </TableCell>
                      <TableCell>
                        {reservation.passengers && reservation.passengers[0] ? (
                          <div>
                            <div className="font-medium">
                              {reservation.passengers[0].firstName} {reservation.passengers[0].lastName}
                            </div>
                            {reservation.passengers.length > 1 && (
                              <div className="text-xs text-gray-500">
                                +{reservation.passengers.length - 1} pasajeros
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {formatTripDate(String(reservation.trip.departureDate))}
                          </span>
                          <span className="text-xs text-gray-500">
                            {reservation.trip.departureTime}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{reservation.trip.route.name}</span>
                          <span className="text-xs text-gray-500">
                            {reservation.trip.segmentOrigin || reservation.trip.route.origin} → {reservation.trip.segmentDestination || reservation.trip.route.destination}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatPrice(reservation.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            reservation.status === "confirmed"
                              ? "default"
                              : reservation.status === "pending"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {reservation.status === "confirmed"
                            ? "Confirmada"
                            : reservation.status === "pending"
                            ? "Pendiente"
                            : "Cancelada"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reservation.createdByUser ? (
                          <div className="flex flex-col">
                            <span className="font-medium flex items-center">
                              <UserIcon className="h-3.5 w-3.5 mr-1 text-primary/70" />
                              {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {reservation.createdByUser.role}
                              {reservation.createdByUser.companyId && ` - ${reservation.createdByUser.companyId}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link to={`/reservation/${reservation.id}`}>
                          <Button size="sm" variant="outline">
                            <ClipboardListIcon className="h-4 w-4 mr-1" />
                            Detalles
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              No hay reservaciones por comisionistas que coincidan con los filtros.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}