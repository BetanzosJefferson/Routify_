import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Calendar, Clock, User } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Reservation } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TicketCheckedModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | undefined;
  isFirstScan: boolean;
}

const TicketCheckedModal: React.FC<TicketCheckedModalProps> = ({
  isOpen,
  onClose,
  reservation,
  isFirstScan,
}) => {
  if (!reservation) return null;

  // Obtener iniciales de la empresa para el avatar
  const getCompanyInitials = () => {
    // Si tenemos BAMO como compañía
    if (reservation.companyId === "bamo-456") {
      return "BA";
    }
    // Usar el nombre de la compañía desde los datos del viaje o un valor predeterminado
    const companyName = "TR";
    return companyName.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center">
            {isFirstScan ? (
              <CheckCircle className="h-16 w-16 text-green-500 mb-2" />
            ) : (
              <AlertTriangle className="h-16 w-16 text-amber-500 mb-2" />
            )}
            <DialogTitle className="text-xl mt-2">
              {isFirstScan ? "Ticket Verificado" : "Ticket Ya Verificado"}
            </DialogTitle>
            <DialogDescription className="text-center mt-1">
              {isFirstScan
                ? "El ticket ha sido verificado correctamente."
                : "Este ticket ya fue verificado anteriormente."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="bg-gray-50 p-4 rounded-lg mt-4">
          <div className="flex items-center justify-center mb-4">
            <Avatar className="h-12 w-12 border border-gray-200">
              <AvatarImage src="/bamo-logo.svg" alt="BAMO" />
              <AvatarFallback className="bg-primary text-white font-medium">
                {getCompanyInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="font-medium text-gray-900">Reservación #{reservation.id}</p>
              <p className="text-sm text-gray-500">
                {reservation.companyId === "bamo-456" ? "BAMO" : "Transportes"}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500 font-medium">PASAJERO</p>
                <p>
                  {reservation.email || 'Pasajero'}
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500 font-medium">MONTO</p>
                <p>${reservation.totalAmount.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <Clock className="h-5 w-5 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-500 font-medium">ESTADO DE PAGO</p>
                <p className={reservation.paymentStatus === 'pagado' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                  {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            {isFirstScan ? (
              <p className="text-green-600 font-medium text-center">
                Verificado el {reservation.checkedAt ? formatDate(new Date(reservation.checkedAt)) : 'ahora mismo'}
              </p>
            ) : (
              <div className="text-amber-600 font-medium text-center space-y-1">
                <p>El ticket ya fue verificado por:</p>
                <p className="font-bold">
                  {reservation.checkedBy ? `Usuario ID: ${reservation.checkedBy}` : 'Otro usuario'}
                </p>
                <p className="text-sm text-gray-500">
                  El {reservation.checkedAt ? formatDate(new Date(reservation.checkedAt)) : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-center mt-4">
          <Button onClick={onClose} className="w-full sm:w-auto px-6">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketCheckedModal;