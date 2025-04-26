import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Users, UserCheck, Bus, Calendar, Clock, MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function TripPassengersPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/trip/:id/passengers");
  const tripId = params?.id ? parseInt(params.id, 10) : undefined;
  
  // Definir tipos para los datos
  interface Vehicle {
    id: number;
    brand: string;
    model: string;
    plates: string;
    economicNumber: string;
    capacity: number;
    type: string;
  }

  interface Route {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  }

  interface Trip {
    id: number;
    routeId: number;
    departureDate: string;
    departureTime: string;
    arrivalTime: string;
    capacity: number;
    availableSeats: number;
    price: number;
    vehicleType: string;
    vehicleId: number | null;
    driverId: number | null;
    status?: string;
    route: Route;
    assignedVehicle?: Vehicle;
  }

  interface Passenger {
    id: number;
    firstName: string;
    lastName: string;
    reservationId: number;
  }

  interface Reservation {
    id: number;
    tripId: number;
    status: string;
    email: string;
    phone: string;
    passengers: Passenger[];
  }

  // Obtener detalles del viaje
  const { data: trip, isLoading: isLoadingTrip } = useQuery<Trip>({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  // Obtener reservaciones para este viaje
  const { data: allReservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
    enabled: !!tripId,
  });

  // Filtrar reservaciones para este viaje
  const tripReservations = allReservations?.filter(
    (res) => res.tripId === tripId
  ) || [];

  // Obtener todos los pasajeros de este viaje
  const passengers = tripReservations.flatMap(
    (reservation) => reservation.passengers || []
  );

  // Función para formatear fecha
  const formatDate = (dateString: string | Date) => {
    return format(
      new Date(dateString),
      "EEEE d 'de' MMMM, yyyy",
      { locale: es }
    );
  };

  if (isLoadingTrip || isLoadingReservations) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="flex items-center mb-6">
          <Button
            variant="outline"
            size="icon"
            className="mr-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 text-center">
        <div className="py-12">
          <h1 className="text-2xl font-bold mb-4">Viaje no encontrado</h1>
          <p className="text-muted-foreground mb-6">
            El viaje que buscas no existe o no tienes permiso para verlo.
          </p>
          <Button onClick={() => window.history.back()}>
            Volver atrás
          </Button>
        </div>
      </div>
    );
  }

  // Calcular la ocupación
  const occupancyRate = Math.round(
    ((trip.capacity - trip.availableSeats) / trip.capacity) * 100
  );

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="icon"
          className="mr-4"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Lista de Pasajeros
          </h1>
          <p className="text-muted-foreground">
            Viaje {trip.route.name} del {formatDate(trip.departureDate)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Información del Viaje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{formatDate(trip.departureDate)}</span>
              </div>
              <div className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>
                  {trip.departureTime} - {trip.arrivalTime}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>
                  {trip.route.origin} → {trip.route.destination}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Detalles del Vehículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trip.assignedVehicle ? (
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <Bus className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>
                    {trip.assignedVehicle.brand} {trip.assignedVehicle.model}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Badge variant="outline">
                    {trip.assignedVehicle.plates}
                  </Badge>
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-muted-foreground">
                    Número económico: {trip.assignedVehicle.economicNumber}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-sm text-muted-foreground">
                No hay vehículo asignado
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Ocupación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={occupancyRate} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <div>
                  <Users className="h-4 w-4 inline mr-1" />
                  <span>
                    {trip.capacity - trip.availableSeats}/{trip.capacity} asientos
                  </span>
                </div>
                <span>{occupancyRate}% ocupado</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pasajeros ({passengers.length})</CardTitle>
              <CardDescription>
                Lista completa de pasajeros para este viaje
              </CardDescription>
            </div>
            {/* Aquí podrías añadir acciones como imprimir lista o marcar asistencia */}
          </div>
        </CardHeader>
        <CardContent>
          {passengers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No hay pasajeros</h3>
              <p className="text-muted-foreground">
                Este viaje aún no tiene pasajeros registrados.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">No. Reservación</TableHead>
                  <TableHead className="hidden md:table-cell">Contacto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((passenger, index: number) => {
                  // Encontrar la reservación a la que pertenece este pasajero
                  const reservation = tripReservations.find(
                    (res) => res.id === passenger.reservationId
                  );

                  return (
                    <TableRow key={passenger.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        {passenger.firstName} {passenger.lastName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {passenger.reservationId}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {reservation?.email || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="capitalize">
                          {reservation?.status || "confirmado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}