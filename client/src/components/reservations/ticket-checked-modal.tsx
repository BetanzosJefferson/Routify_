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
import { CheckCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Reservation } from "@shared/schema";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isFirstScan ? "Ticket Verificado" : "Ticket Ya Verificado"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isFirstScan
              ? "Este ticket ha sido verificado por primera vez."
              : "Este ticket ya había sido verificado anteriormente."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4">
          <CheckCircle
            className={`h-16 w-16 ${
              isFirstScan ? "text-green-500" : "text-amber-500"
            } mb-4`}
          />

          <div className="text-center space-y-2">
            <p className="font-semibold">
              Reservación #{reservation.id}
            </p>
            <p>
              <span className="font-medium">Estado de pago:</span>{" "}
              <span
                className={`font-bold ${
                  reservation.paymentStatus === "pagado"
                    ? "text-green-600"
                    : "text-amber-600"
                }`}
              >
                {reservation.paymentStatus === "pagado" ? "PAGADO" : "PENDIENTE"}
              </span>
            </p>
            {isFirstScan && reservation.checkedAt && (
              <p>
                <span className="font-medium">Verificado el:</span>{" "}
                {formatDate(new Date(reservation.checkedAt))}
              </p>
            )}
            {!isFirstScan && reservation.checkCount && (
              <p>
                <span className="font-medium">Veces escaneado:</span>{" "}
                {reservation.checkCount}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-center">
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketCheckedModal;