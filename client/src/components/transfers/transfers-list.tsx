import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TransferDetailsModal } from "./transfer-details-modal";

// Interfaces para tipado
interface TripTransfer {
  id: number;
  sourceCompanyId: string;
  targetCompanyId: string;
  sourceTripId: number;
  targetTripId: number;
  status: string;
  reason?: string;
  requestedAt: string;
  respondedAt?: string;
  createdBy?: number;
  approvedBy?: number;
  routeMapping?: {
    originMatches: boolean;
    destinationMatches: boolean;
    skippedStops: string[];
    additionalStops: string[];
  };
}

interface TransfersListProps {
  transfers: TripTransfer[];
  onRefresh: () => void;
}

export const TransfersList = ({ transfers, onRefresh }: TransfersListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null);
  const [transferToApprove, setTransferToApprove] = useState<number | null>(null);
  const [transferToReject, setTransferToReject] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleViewDetails = (transferId: number) => {
    setSelectedTransfer(transferId);
  };

  const handleApproveTransfer = async () => {
    if (!transferToApprove) return;
    
    setIsLoading(true);
    try {
      await apiRequest("PATCH", `/api/transfers/${transferToApprove}/status`, {
        status: "aprobado"
      });
      
      toast({
        title: "Transferencia aprobada",
        description: "La transferencia ha sido aprobada exitosamente",
      });
      
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo aprobar la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTransferToApprove(null);
    }
  };

  const handleRejectTransfer = async () => {
    if (!transferToReject) return;
    
    setIsLoading(true);
    try {
      await apiRequest("PATCH", `/api/transfers/${transferToReject}/status`, {
        status: "rechazado"
      });
      
      toast({
        title: "Transferencia rechazada",
        description: "La transferencia ha sido rechazada",
      });
      
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo rechazar la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTransferToReject(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pendiente":
        return <Badge variant="outline">Pendiente</Badge>;
      case "aprobado":
        return <Badge variant="success">Aprobado</Badge>;
      case "rechazado":
        return <Badge variant="destructive">Rechazado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const canApprove = (transfer: TripTransfer) => {
    // Solo puede aprobar la empresa destino o superAdmin
    return (
      transfer.status === "pendiente" &&
      (user?.role === "superAdmin" || user?.companyId === transfer.targetCompanyId)
    );
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd MMM yyyy, HH:mm", { locale: es });
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Compañía Origen</TableHead>
              <TableHead>Compañía Destino</TableHead>
              <TableHead>Fecha Solicitada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">{transfer.id}</TableCell>
                <TableCell>{transfer.sourceCompanyId}</TableCell>
                <TableCell>{transfer.targetCompanyId}</TableCell>
                <TableCell>{formatDate(transfer.requestedAt)}</TableCell>
                <TableCell>{renderStatusBadge(transfer.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(transfer.id)}
                    >
                      Detalles
                    </Button>
                    
                    {canApprove(transfer) && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setTransferToApprove(transfer.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setTransferToReject(transfer.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal de detalles */}
      {selectedTransfer && (
        <TransferDetailsModal 
          transferId={selectedTransfer} 
          isOpen={!!selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
        />
      )}

      {/* Diálogo de confirmación de aprobación */}
      <AlertDialog 
        open={!!transferToApprove} 
        onOpenChange={(open) => !open && setTransferToApprove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprobación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas aprobar esta transferencia? 
              Las reservaciones serán transferidas al viaje de destino.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApproveTransfer}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Aprobar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de rechazo */}
      <AlertDialog 
        open={!!transferToReject} 
        onOpenChange={(open) => !open && setTransferToReject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar rechazo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas rechazar esta transferencia?
              La solicitud será cancelada y las reservaciones permanecerán con la compañía original.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRejectTransfer}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Rechazar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};