import React, { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { CashRegister, CalendarIcon, FileText, AlertCircle } from "lucide-react";
import { useCashPayments } from "@/hooks/use-cash-payments";

export default function CashierPage() {
  const { toast } = useToast();
  const [showCashCutDialog, setShowCashCutDialog] = useState(false);
  const { cashPayments, isLoading, totalCashAmount, clearCashPayments } = useCashPayments();

  // Función para realizar el corte de caja
  const handleCashCut = async () => {
    try {
      await clearCashPayments();
      setShowCashCutDialog(false);
      
      toast({
        title: "Corte de caja realizado",
        description: `Se ha registrado el corte por ${formatCurrency(totalCashAmount)}`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error al realizar el corte",
        description: "Ocurrió un problema al procesar el corte de caja",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <header className="mb-6">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
              <CashRegister className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Caja</h1>
          </div>
          <p className="text-gray-500">
            Administra los pagos en efectivo y realiza cortes de caja
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Total en Caja</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {isLoading ? "Cargando..." : formatCurrency(totalCashAmount)}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Total de pagos en efectivo pendientes de corte
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Pagos Registrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? "Cargando..." : cashPayments.length}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Número de pagos en efectivo registrados
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-primary bg-opacity-5 border-primary border-opacity-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Acciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowCashCutDialog(true)}
                className="w-full"
                disabled={isLoading || totalCashAmount === 0}
              >
                Hacer Corte
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                Registra el corte de caja y reinicia el conteo
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Historial de Pagos en Efectivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Cargando pagos...</p>
              </div>
            ) : cashPayments.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-1">No hay pagos registrados</h3>
                <p className="text-gray-500">
                  Los pagos en efectivo que marques como cobrados aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {cashPayments.map((payment) => (
                  <div key={payment.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{payment.passengerName}</h4>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <span>{payment.origin} → {payment.destination}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <span>
                            {payment.paymentDate} · Cobrado por {payment.collectedBy}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-primary">
                          {formatCurrency(payment.amount)}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          Efectivo
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Corte de Caja */}
      <Dialog open={showCashCutDialog} onOpenChange={setShowCashCutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Corte de Caja</DialogTitle>
            <DialogDescription>
              Estás a punto de realizar un corte de caja por el monto acumulado.
              Este proceso registrará el corte y reiniciará el contador.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-700 mb-2">Resumen del Corte</h3>
              
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span>Total de pagos</span>
                <span>{cashPayments.length}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span>Monto total</span>
                <span className="font-bold">{formatCurrency(totalCashAmount)}</span>
              </div>
              
              <div className="flex justify-between py-2 mt-2">
                <span className="font-medium">Total a entregar</span>
                <span className="font-bold text-primary text-lg">
                  {formatCurrency(totalCashAmount)}
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashCutDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCashCut}>
              Confirmar Corte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}