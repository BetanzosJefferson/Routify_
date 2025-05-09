import React, { useState } from "react";
import { Layout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Wallet, History, Loader } from "lucide-react";
import { useCashPayments, CashPayment, CashCut } from "@/hooks/use-cash-payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CashierPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const {
    pendingPayments,
    cashCuts,
    isLoadingPayments,
    isLoadingCuts,
    pendingTotal,
    showCutModal,
    setShowCutModal,
    makeCashCut,
    isCutting,
    refetchPayments,
    refetchCuts,
  } = useCashPayments();

  // Función para hacer un corte de caja
  const handleCashCut = () => {
    if (pendingPayments.length === 0) {
      toast({
        title: "No hay pagos pendientes",
        description: "No se puede realizar un corte de caja sin pagos pendientes",
        variant: "destructive",
      });
      return;
    }

    // Mostrar el modal de confirmación
    setShowCutModal(true);
  };

  // Función para confirmar el corte de caja
  const confirmCashCut = () => {
    makeCashCut();
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Caja</h1>
            <p className="text-gray-500 mt-1">Gestión de pagos en efectivo y cortes de caja</p>
          </div>
          <Button
            onClick={handleCashCut}
            className="bg-green-600 hover:bg-green-700"
            disabled={pendingPayments.length === 0 || isCutting}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Hacer corte
          </Button>
        </div>

        <div className="grid gap-6 mb-8">
          <Card>
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5 text-primary" />
                Total en Caja
              </CardTitle>
              <CardDescription>Monto total pendiente de corte</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">
                {formatCurrency(pendingTotal)}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {pendingPayments.length} {pendingPayments.length === 1 ? "pago" : "pagos"} pendientes
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="pending" className="text-center">
              Pagos Pendientes
            </TabsTrigger>
            <TabsTrigger value="history" className="text-center">
              Historial de Cortes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pagos Pendientes</CardTitle>
                <CardDescription>
                  Listado de pagos en efectivo pendientes de corte
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPayments ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay pagos pendientes
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] w-full pr-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pasajero</TableHead>
                          <TableHead>Ruta</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">
                              {payment.passengerName}
                            </TableCell>
                            <TableCell>
                              {payment.origin} - {payment.destination}
                            </TableCell>
                            <TableCell>{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>
                              {formatDate(new Date(payment.createdAt))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
              <CardFooter className="border-t bg-muted/20 flex justify-between">
                <div className="text-sm text-gray-500">
                  {pendingPayments.length} {pendingPayments.length === 1 ? "pago" : "pagos"} pendientes
                </div>
                <div className="font-semibold">
                  Total: {formatCurrency(pendingTotal)}
                </div>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  Historial de Cortes
                </CardTitle>
                <CardDescription>
                  Registro de cortes de caja realizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCuts ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : cashCuts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay cortes de caja registrados
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] w-full pr-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Usuario</TableHead>
                          <TableHead>Pagos</TableHead>
                          <TableHead>Monto Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashCuts.map((cut) => (
                          <TableRow key={cut.id}>
                            <TableCell>
                              {formatDate(new Date(cut.createdAt))}
                            </TableCell>
                            <TableCell>
                              {cut.user?.firstName} {cut.user?.lastName}
                            </TableCell>
                            <TableCell>{cut.paymentsCount}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(cut.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de confirmación de corte de caja */}
      <Dialog open={showCutModal} onOpenChange={setShowCutModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar corte de caja</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas realizar un corte de caja con los siguientes pagos?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Total pagos:</span>
              <Badge>{pendingPayments.length}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold">Monto total:</span>
              <span className="text-xl font-bold">{formatCurrency(pendingTotal)}</span>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCutModal(false)} disabled={isCutting}>
              Cancelar
            </Button>
            <Button onClick={confirmCashCut} disabled={isCutting}>
              {isCutting ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar Corte"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}