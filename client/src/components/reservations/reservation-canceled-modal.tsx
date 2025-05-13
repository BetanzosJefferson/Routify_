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
import { Badge } from "@/components/ui/badge";
import { Hash, XCircle } from "lucide-react";
import { Reservation } from "@shared/schema";

interface ReservationCanceledModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | undefined;
}

const ReservationCanceledModal: React.FC<ReservationCanceledModalProps> = ({
  isOpen,
  onClose,
  reservation,
}) => {
  if (!reservation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <span className="text-red-600">Reservación Cancelada</span>
          </DialogTitle>
          <DialogDescription className="text-center">
            Esta reservación ha sido cancelada y no puede ser procesada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative mb-4">
            <div className="absolute -inset-1 rounded-full bg-red-200 blur-sm"></div>
            <XCircle className="relative h-20 w-20 text-red-500" />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg w-full max-w-sm border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <div className="flex items-center">
                <Hash className="h-4 w-4 mr-1 text-gray-500" />
                <span className="font-bold text-lg">Reservación #{reservation.id}</span>
              </div>
              <Badge 
                variant="outline"
                className="bg-red-100 text-red-800 border-red-200"
              >
                CANCELADA
              </Badge>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Esta reservación ha sido cancelada y no puede ser procesada. Por favor, contacte al administrador si necesita más información.
              </p>

              <div className="bg-gray-100 p-2 rounded-md border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Precio original:</span>
                  <span className="text-sm font-medium line-through text-gray-500">
                    ${reservation.totalAmount.toLocaleString('es-MX')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-gray-700">Ingreso real:</span>
                  <span className="text-sm font-medium">
                    ${(reservation.advanceAmount || 0).toLocaleString('es-MX')}
                  </span>
                </div>
              </div>
              
              {reservation.advanceAmount > 0 && (
                <div className="bg-amber-50 p-2 rounded-md border border-amber-100">
                  <p className="text-sm text-amber-700">
                    Esta reservación tenía un anticipo de ${reservation.advanceAmount.toLocaleString('es-MX')} que no será reembolsado.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center mt-4">
          <Button 
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationCanceledModal;