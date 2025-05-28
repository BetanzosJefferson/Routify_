import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Check, Clock } from "lucide-react";

interface PackageDetailModalProps {
  package: any;
  isOpen: boolean;
  onClose: () => void;
}

export function PackageDetailModal({ package: pkg, isOpen, onClose }: PackageDetailModalProps) {
  if (!pkg) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalles del Paquete #{pkg.id}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">INFORMACIÓN DEL PAQUETE</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Descripción:</span>
                  <p className="text-sm">{pkg.packageDescription || "Sin descripción"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Precio:</span>
                  <p className="text-sm">{formatCurrency(pkg.price)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Asientos:</span>
                  <div className="mt-1">
                    {pkg.usesSeats ? (
                      <Badge className="bg-orange-500 hover:bg-orange-600">
                        {pkg.seatsQuantity} {pkg.seatsQuantity === 1 ? 'asiento' : 'asientos'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No usa asientos</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Estado de Pago:</span>
                  <div className="mt-1">
                    {pkg.isPaid ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <Check className="mr-1 h-3 w-3" /> Pagado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" /> Pendiente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">REMITENTE</h3>
              <div className="space-y-1">
                <p className="text-sm"><span className="font-medium">Nombre:</span> {pkg.senderName} {pkg.senderLastName}</p>
                <p className="text-sm"><span className="font-medium">Teléfono:</span> {pkg.senderPhone}</p>
                {pkg.senderEmail && (
                  <p className="text-sm"><span className="font-medium">Email:</span> {pkg.senderEmail}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">DESTINATARIO</h3>
              <div className="space-y-1">
                <p className="text-sm"><span className="font-medium">Nombre:</span> {pkg.recipientName} {pkg.recipientLastName}</p>
                <p className="text-sm"><span className="font-medium">Teléfono:</span> {pkg.recipientPhone}</p>
                {pkg.recipientEmail && (
                  <p className="text-sm"><span className="font-medium">Email:</span> {pkg.recipientEmail}</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">RUTA</h3>
              <div className="space-y-1">
                <p className="text-sm"><span className="font-medium">Origen:</span> {pkg.segmentOrigin || pkg.tripOrigin || "No disponible"}</p>
                <p className="text-sm"><span className="font-medium">Destino:</span> {pkg.segmentDestination || pkg.tripDestination || "No disponible"}</p>
              </div>
            </div>

            {pkg.createdAt && (
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">FECHAS</h3>
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-medium">Creado:</span> {new Date(pkg.createdAt).toLocaleDateString()}</p>
                  {pkg.updatedAt && (
                    <p className="text-sm"><span className="font-medium">Actualizado:</span> {new Date(pkg.updatedAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}