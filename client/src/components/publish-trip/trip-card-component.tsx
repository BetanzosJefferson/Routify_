import React from 'react';
import { format } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  CarIcon,
  UserIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeToStartOfDay } from "@/lib/utils";
import TripStatusBadges from "@/components/trips/trip-status-badges";

// Interfaces
interface Trip {
  id: number;
  routeId: number;
  route?: any;
  routeName?: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  companyName?: string;
  companyLogo?: string;
  assignedVehicle?: any;
  assignedDriver?: any;
  driverId?: number;
  reservationCount?: number;
  visibility?: string;
  tripStatus?: string;
}

interface Driver {
  id: number;
  firstName: string;
  lastName: string;
}

interface TripCardProps {
  trip: Trip;
  drivers: Driver[];
  onEditClick: (tripId: number) => void;
  onDeleteClick: (tripId: number) => void;
  onAssignVehicle: (tripId: number) => void;
  onAssignDriver: (tripId: number) => void;
}

// Formatear hora para mostrar
const formatTime = (timeString: string) => {
  return timeString;
};

export const TripCard: React.FC<TripCardProps> = ({
  trip,
  drivers,
  onEditClick,
  onDeleteClick,
  onAssignVehicle,
  onAssignDriver,
}) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex flex-col lg:flex-row">
        <div className="p-4 lg:p-6 flex-1">
          <div className="flex justify-between items-start">
            <div className="flex">
              {/* Logo de la compañía (si existe) */}
              {trip.companyLogo ? (
                <div className="mr-3 h-12 w-12 flex-shrink-0">
                  <img 
                    src={trip.companyLogo} 
                    alt={trip.companyName || "Logo de transportista"} 
                    className="h-full w-full object-cover rounded-full border border-gray-100"
                    onError={(e) => {
                      // Si falla la carga, ocultar la imagen
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                    }} 
                  />
                </div>
              ) : null}
              
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="text-base font-medium">
                    {trip.route?.name || trip.routeName || `Ruta #${trip.routeId}`}
                  </h4>
                  <TripStatusBadges
                    visibility={trip.visibility}
                    tripStatus={trip.tripStatus}
                  />
                </div>
                {trip.companyName && (
                  <div className="text-xs text-gray-500 mb-1">
                    {trip.companyName}
                  </div>
                )}
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  <span>
                    {format(normalizeToStartOfDay(trip.departureDate), "dd/MM/yyyy")}
                  </span>
                  <ClockIcon className="h-4 w-4 ml-4 mr-1" />
                  <span>{formatTime(trip.departureTime)} - {formatTime(trip.arrivalTime)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Primera columna: Ruta */}
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="flex items-start mb-2">
                <MapPinIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium">Ruta</h5>
                  <p className="text-xs text-muted-foreground">
                    {trip.route?.stops?.length || 0} paradas intermedias
                  </p>
                </div>
              </div>
            </div>
            
            {/* Segunda columna: Vehículo */}
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="flex justify-between">
                <div className="flex items-start">
                  <CarIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-medium">Vehículo</h5>
                    {trip.assignedVehicle ? (
                      <p className="text-xs capitalize">
                        {trip.assignedVehicle.model} - {trip.assignedVehicle.plates}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 font-medium">No asignado</p>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 rounded-full"
                  onClick={() => onAssignVehicle(trip.id)}
                >
                  {trip.assignedVehicle ? <CheckIcon className="h-4 w-4 text-green-500" /> : 'Asignar'}
                </Button>
              </div>
            </div>
            
            {/* Tercera columna: Conductor */}
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="flex justify-between">
                <div className="flex items-start">
                  <UserIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-medium">Conductor</h5>
                    {trip.assignedDriver || trip.driverId ? (
                      <p className="text-xs capitalize">
                        {trip.assignedDriver ? 
                          `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}` :
                          `${drivers.find((d) => d.id === trip.driverId)?.firstName || ''} ${drivers.find((d) => d.id === trip.driverId)?.lastName || ''}`
                        }
                      </p>
                    ) : (
                      <p className="text-xs text-red-500 font-medium">No asignado</p>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 rounded-full"
                  onClick={() => onAssignDriver(trip.id)}
                >
                  {trip.assignedDriver || trip.driverId ? <CheckIcon className="h-4 w-4 text-green-500" /> : 'Asignar'}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            {trip.assignedVehicle?.model && (
              <div className="text-sm">
                <span className="capitalize">{trip.assignedVehicle.model} - {trip.assignedVehicle.plates}</span>
              </div>
            )}
            
            <div className="flex items-center">
              <UsersIcon className="h-4 w-4 mr-1 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-2">
                {trip.reservationCount || 0} reservas
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-4 lg:p-6 flex flex-row lg:flex-col items-center justify-between border-t lg:border-t-0 lg:border-l bg-muted/20">
          <Button
            variant="outline"
            size="sm" 
            className="h-8 px-4 border-primary text-primary"
            onClick={() => onEditClick(trip.id)}
          >
            <PencilIcon className="h-3.5 w-3.5 mr-1.5" />
            <span>Editar</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-4 ml-2 lg:ml-0 lg:mt-3 border-destructive text-destructive"
            onClick={() => onDeleteClick(trip.id)}
          >
            <span>Eliminar</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TripCard;