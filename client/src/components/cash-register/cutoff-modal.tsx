import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, DollarSign } from "lucide-react";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CutoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isLoading: boolean;
}

export function CutoffModal({ isOpen, onClose, onConfirm, isLoading }: CutoffModalProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  
  // Cargar datos actualizados directamente en este componente
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["/api/cashbox/transactions/fresh"],
    queryFn: async () => {
      if (!isOpen) return null; // Solo cargar cuando el modal esté abierto
      
      const response = await fetch('/api/cashbox/transactions');
      if (!response.ok) {
        throw new Error("Error al obtener transacciones");
      }
      return response.json();
    },
    enabled: isOpen, // Solo activar la consulta cuando el modal esté abierto
    refetchOnWindowFocus: false,
    staleTime: 0 // Asegurar que siempre se carguen datos frescos
  });
  
  // Calcular totales con los datos frescos
  const totals = {
    totalCash: 0,
    totalTransfer: 0,
    totalAmount: 0,
    transactionCount: 0
  };
  
  if (transactionsData && Array.isArray(transactionsData)) {
    totals.transactionCount = transactionsData.length;
    
    // Calcular totales basados en los datos más recientes
    transactionsData.forEach((t: any) => {
      // Manejar pagos en efectivo
      if (t.advancePaymentMethod === 'efectivo') {
        totals.totalCash += t.advanceAmount || 0;
      }
      if (t.paymentMethod === 'efectivo') {
        totals.totalCash += (t.totalAmount || 0) - (t.advanceAmount || 0);
      }
      
      // Manejar pagos por transferencia
      if (t.advancePaymentMethod === 'transferencia') {
        totals.totalTransfer += t.advanceAmount || 0;
      }
      if (t.paymentMethod === 'transferencia') {
        totals.totalTransfer += (t.totalAmount || 0) - (t.advanceAmount || 0);
      }
    });
    
    totals.totalAmount = totals.totalCash + totals.totalTransfer;
  }
  
  // Reiniciar notas cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setNotes("");
    }
  }, [isOpen]);
  
  const handleConfirm = () => {
    onConfirm(notes);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar corte de caja</DialogTitle>
          <DialogDescription>
            Por favor verifica los detalles del corte antes de confirmar.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingTransactions ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p>Cargando datos actualizados...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-secondary/10">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Usuario</p>
                  <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : "Usuario"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium">{new Date().toLocaleString('es-MX', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium text-primary">{formatPrice(totals.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transacciones</p>
                  <p className="font-medium">{totals.transactionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="font-medium text-green-600">{formatPrice(totals.totalCash)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Transferencia</p>
                  <p className="font-medium text-blue-600">{formatPrice(totals.totalTransfer)}</p>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="notes" className="text-sm font-medium">
                Notas para el corte (opcional)
              </label>
              <Textarea
                id="notes"
                placeholder="Agregar notas al corte..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}
        
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || isLoadingTransactions}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Realizar corte e imprimir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}