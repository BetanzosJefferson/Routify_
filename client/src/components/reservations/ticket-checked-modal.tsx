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
import { CheckCircle, UserCheck, Calendar, Hash, CreditCard } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Reservation } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

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
  const { user } = useAuth();
  
  if (!reservation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isFirstScan ? (
              <span className="text-green-600">¡Ticket Verificado Exitosamente!</span>
            ) : (
              <span className="text-amber-600">Ticket Ya Verificado</span>
            )}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isFirstScan
              ? "Este ticket ha sido escaneado y verificado por primera vez."
              : "Este ticket ya había sido verificado anteriormente."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          {isFirstScan ? (
            <div className="relative mb-4">
              <div className="absolute -inset-1 rounded-full bg-green-200 blur-sm"></div>
              <CheckCircle className="relative h-20 w-20 text-green-500 animate-pulse" />
            </div>
          ) : (
            <CheckCircle className="h-16 w-16 text-amber-500 mb-4" />
          )}

          <div className="bg-gray-50 p-4 rounded-lg w-full max-w-sm border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <div className="flex items-center">
                <Hash className="h-4 w-4 mr-1 text-gray-500" />
                <span className="font-bold text-lg">Reservación #{reservation.id}</span>
              </div>
              <Badge 
                variant={reservation.paymentStatus === "paid" ? "outline" : "default"}
                className={reservation.paymentStatus === "paid" 
                  ? "border-green-500 text-green-700 bg-green-50" 
                  : "bg-yellow-100 text-yellow-700"}
              >
                {reservation.paymentStatus === "paid" ? "PAGADO" : "PENDIENTE"}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {isFirstScan && (
                <div className="bg-green-50 p-2 rounded-md border border-green-100">
                  <p className="text-sm text-green-700 flex items-center">
                    <UserCheck className="h-4 w-4 mr-2" />
                    <span className="font-medium">Verificado por:</span>{" "}
                    <span className="ml-1 font-semibold">{user?.firstName} {user?.lastName}</span>
                  </p>
                </div>
              )}
              
              {reservation.checkedAt && (
                <p className="text-sm flex items-center text-gray-700">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="font-medium">Fecha de verificación:</span>{" "}
                  <span className="ml-1">{formatDate(new Date(reservation.checkedAt))}</span>
                </p>
              )}
              
              {!isFirstScan && reservation.checkCount && (
                <p className="text-sm flex items-center text-gray-700">
                  <span className="font-medium mr-2">Veces escaneado:</span>{" "}
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                    {reservation.checkCount}
                  </Badge>
                </p>
              )}
              
              <p className="text-sm flex items-center text-gray-700">
                <CreditCard className="h-4 w-4 mr-2 text-gray-500" />
                <span className="font-medium">Importe total:</span>{" "}
                <span className="ml-1 font-semibold">${reservation.totalAmount.toLocaleString('es-MX')}</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center mt-4">
          <Button 
            onClick={onClose}
            className={isFirstScan ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketCheckedModal;