import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Card, 
  CardContent, 
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronDown } from 'lucide-react';

interface TransferredReservationCardProps {
  reservation: any;
  onContinue?: (reservation: any) => void;
  processed?: boolean;
}

const TransferredReservationCard: React.FC<TransferredReservationCardProps> = ({
  reservation,
  onContinue,
  processed = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className={`w-full mb-4 ${processed ? 'border-green-400 bg-green-50/20' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base flex items-center">
              Reservación #{reservation.id}
              {processed && (
                <Badge variant="outline" className="ml-2 text-green-600 border-green-400 bg-green-50">
                  Transferida ✓
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-sm">
              {reservation.trip?.route?.origin} → {reservation.trip?.route?.destination}
            </CardDescription>
          </div>
          <Badge variant={
            reservation.status === 'confirmado' || reservation.status === 'confirmed' ? 'default' :
            reservation.status === 'pendiente' ? 'outline' :
            reservation.status === 'cancelado' ? 'destructive' : 'secondary'
          }>
            {reservation.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 pb-2">
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <span className="text-muted-foreground">Fecha:</span>{' '}
            {reservation.trip?.departureDate && (
              <span className="font-medium">
                {format(new Date(reservation.trip.departureDate), "dd MMM yyyy", { locale: es })}
              </span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Precio:</span>{' '}
            <span className="font-medium">{formatCurrency(reservation.totalAmount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pasajeros:</span>{' '}
            <span className="font-medium">{reservation.passengers?.length || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Estado pago:</span>{' '}
            <span className="font-medium">{reservation.paymentStatus || 'No definido'}</span>
          </div>
        </div>
        
        {isExpanded && (
          <>
            <Separator className="my-2" />
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="reservation-details" className="border-b-0">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  Detalles de la reservación
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2">
                    <div>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <span className="font-medium">{reservation.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono:</span>{' '}
                      <span className="font-medium">{reservation.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Creada:</span>{' '}
                      <span>
                        {reservation.createdAt && 
                          format(new Date(reservation.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Método de pago:</span>{' '}
                      <span className="font-medium">{reservation.paymentMethod || 'No definido'}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="trip-details" className="border-b-0">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  Información del viaje
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-2 text-xs py-2">
                    <div>
                      <span className="text-muted-foreground">Viaje ID:</span>{' '}
                      <span className="font-medium">{reservation.trip?.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ruta ID:</span>{' '}
                      <span className="font-medium">{reservation.trip?.routeId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hora salida:</span>{' '}
                      <span className="font-medium">{reservation.trip?.departureTime}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hora llegada:</span>{' '}
                      <span className="font-medium">{reservation.trip?.arrivalTime}</span>
                    </div>
                  </div>
                  
                  {/* Segmentos de viaje */}
                  {reservation.trip?.segmentPrices && reservation.trip.segmentPrices.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium mb-1">Segmentos:</div>
                      <div className="space-y-1">
                        {reservation.trip.segmentPrices.map((segment: any, index: number) => (
                          <div key={index} className="text-xs border-l-2 border-primary/50 pl-2 py-1">
                            <div className="flex justify-between">
                              <div className="truncate max-w-[70%]">{segment.origin} → {segment.destination}</div>
                              <div>{formatCurrency(segment.price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="passengers-list" className="border-b-0">
                <AccordionTrigger className="py-2 text-xs font-medium">
                  Pasajeros ({reservation.passengers?.length || 0})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 py-2">
                    {reservation.passengers?.map((passenger: any) => (
                      <div key={passenger.id} className="text-xs flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5"></span>
                          <span className="font-medium">{passenger.firstName} {passenger.lastName}</span>
                        </div>
                        <span className="text-muted-foreground">ID: {passenger.id}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Menos detalles' : 'Más detalles'} 
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
        
        {!processed && onContinue && (
          <Button 
            size="sm"
            onClick={() => onContinue(reservation)}
          >
            Continuar
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TransferredReservationCard;