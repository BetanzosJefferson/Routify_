import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeftRight, Calendar, User, ArrowRight } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TransferDetailsModal from "@/components/notifications/transfer-details-modal";

// Tipo para las transferencias
type Transfer = {
  id: number;
  direction: 'outgoing' | 'incoming';
  sourceCompany: string;
  targetCompany: string;
  sourceUser: {
    name: string;
  };
  reservationIds: number[];
  transferDate: string;
  reservationCount: number;
  createdAt: string;
  // Información adicional sobre la reservación
  passengerInfo?: {
    name: string;
    origin: string;
    destination: string;
    tripDate?: string;
    isFromCommissioner?: boolean;
    commissionPercentage?: number;
  }[];
};

export function TransferHistory() {
  const [activeTab, setActiveTab] = useState<'all' | 'outgoing' | 'incoming'>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { toast } = useToast();

  // Consulta para obtener el historial de transferencias
  const { data: transfers, isLoading, error } = useQuery<Transfer[]>({
    queryKey: ['/api/transfers/history'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/transfers/history');
        return await response.json();
      } catch (error) {
        console.error("Error al obtener historial de transferencias:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar el historial de transferencias.",
          variant: "destructive",
        });
        throw error;
      }
    }
  });

  // Filtrar transferencias basadas en la pestaña activa
  const filteredTransfers = React.useMemo(() => {
    if (!transfers) return [];
    
    switch (activeTab) {
      case 'outgoing':
        return transfers.filter(transfer => transfer.direction === 'outgoing');
      case 'incoming':
        return transfers.filter(transfer => transfer.direction === 'incoming');
      default:
        return transfers;
    }
  }, [transfers, activeTab]);

  // Obtener el conteo de cada tipo
  const outgoingCount = transfers?.filter(t => t.direction === 'outgoing').length || 0;
  const incomingCount = transfers?.filter(t => t.direction === 'incoming').length || 0;

  // Abrir el modal de detalles
  const openDetailsModal = (transferId: number) => {
    setSelectedTransfer(transferId);
    setDetailsModalOpen(true);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Historial de transferencias</CardTitle>
        <CardDescription>
          Registro de transferencias de pasajeros enviadas y recibidas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as 'all' | 'outgoing' | 'incoming')}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              Todas <Badge variant="outline" className="ml-2">{transfers?.length || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="outgoing">
              Enviadas <Badge variant="outline" className="ml-2">{outgoingCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="incoming">
              Recibidas <Badge variant="outline" className="ml-2">{incomingCount}</Badge>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="pt-4">
            {renderTransferTable(transfers || [], isLoading, error, openDetailsModal)}
          </TabsContent>
          <TabsContent value="outgoing" className="pt-4">
            {renderTransferTable(transfers?.filter(t => t.direction === 'outgoing') || [], isLoading, error, openDetailsModal)}
          </TabsContent>
          <TabsContent value="incoming" className="pt-4">
            {renderTransferTable(transfers?.filter(t => t.direction === 'incoming') || [], isLoading, error, openDetailsModal)}
          </TabsContent>
        </Tabs>

        {/* Modal para ver detalles de una transferencia */}
        <TransferDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          notification={{ 
            id: selectedTransfer || 0,
            userId: 0, 
            type: 'transfer', 
            title: '', 
            message: '', 
            read: false, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
          }}
        />
      </CardContent>
    </Card>
  );
}

// Función auxiliar para renderizar tabla de transferencias
function renderTransferTable(
  transfers: Transfer[] | undefined, 
  isLoading: boolean, 
  error: unknown, 
  openDetailsModal: (id: number) => void
) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Cargando historial de transferencias...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-red-500">
        Error al cargar el historial de transferencias. Intente nuevamente.
      </div>
    );
  }

  if (!transfers || transfers.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No hay transferencias disponibles para mostrar.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Dirección</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Pasajeros</TableHead>
          <TableHead>Origen/Destino</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.map((transfer) => {
          // Determinar información de origen/destino para mostrar
          let originDestInfo = '';
          
          if (transfer.passengerInfo && transfer.passengerInfo.length > 0) {
            const info = transfer.passengerInfo[0]; // Mostrar info del primer pasajero
            originDestInfo = `${info.origin} → ${info.destination}`;
          } else {
            originDestInfo = 'Información no disponible';
          }
          
          return (
            <TableRow key={transfer.id}>
              <TableCell>
                {format(new Date(transfer.transferDate), "dd MMM yyyy, HH:mm", { locale: es })}
              </TableCell>
              <TableCell>
                {transfer.direction === 'outgoing' ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <ArrowRight className="h-3 w-3 mr-1" /> Enviada
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    <ArrowLeftRight className="h-3 w-3 mr-1" /> Recibida
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {transfer.direction === 'outgoing' 
                      ? `A: ${transfer.targetCompany}` 
                      : `De: ${transfer.sourceCompany}`}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center mt-1">
                    <User className="h-3 w-3 mr-1" />
                    {transfer.sourceUser.name}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <Badge variant="secondary">
                      {transfer.reservationCount} {transfer.reservationCount === 1 ? 'pasajero' : 'pasajeros'}
                    </Badge>
                  </div>
                  {transfer.passengerInfo && transfer.passengerInfo.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {transfer.passengerInfo.map((passenger, idx) => (
                        <div key={idx} className="mt-1 truncate flex items-center">
                          {passenger.name}
                          {passenger.isFromCommissioner && (
                            <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 text-[10px] h-5">
                              Comisión {passenger.commissionPercentage}%
                            </Badge>
                          )}
                        </div>
                      )).slice(0, 2)}
                      {transfer.passengerInfo.length > 2 && (
                        <div className="text-xs italic">Y {transfer.passengerInfo.length - 2} más...</div>
                      )}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-[200px] text-sm">
                  {originDestInfo}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => openDetailsModal(transfer.id)}>
                  Ver detalles
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}