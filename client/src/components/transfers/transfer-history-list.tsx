import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

type TransferHistoryItem = {
  id: number;
  requestId: number;
  sourceCompanyId: string;
  sourceCompanyName: string;
  targetCompanyId: string;
  targetCompanyName: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  passengerName: string;
  sourceTrip: {
    id: number;
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  };
  targetTrip: {
    id: number;
    tripNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
  } | null;
  notes: string | null;
};

export function TransferHistoryList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferHistoryItem | null>(null);
  const { toast } = useToast();
  
  const {
    data: history,
    isLoading,
    isError,
  } = useQuery<TransferHistoryItem[]>({
    queryKey: ['/api/transfer-history'],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial de transferencias.',
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completada</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-600">Rechazada</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (timeString: string) => {
    // Formato esperado: "HH:MM:SS" o "HH:MM"
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;
    
    const hour = parseInt(parts[0]);
    const minute = parts[1];
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    
    return `${hour12}:${minute} ${period}`;
  };

  const filteredHistory = history 
    ? history.filter(
        (item) =>
          item.passengerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sourceCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.targetCompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.status.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const handleRowClick = (transfer: TransferHistoryItem) => {
    setSelectedTransfer(transfer);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
          <CardDescription>
            Historial completo de transferencias de pasajeros entre empresas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pasajero, empresa o estado..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>Error al cargar los datos. Por favor, intenta nuevamente.</p>
            </div>
          ) : history?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No hay transferencias en el historial.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pasajero</TableHead>
                    <TableHead>Empresa Origen</TableHead>
                    <TableHead>Empresa Destino</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((transfer) => (
                    <TableRow 
                      key={transfer.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(transfer)}
                    >
                      <TableCell className="font-medium">{transfer.passengerName}</TableCell>
                      <TableCell>{transfer.sourceCompanyName}</TableCell>
                      <TableCell>{transfer.targetCompanyName}</TableCell>
                      <TableCell>{transfer.sourceTrip.origin}</TableCell>
                      <TableCell>{transfer.sourceTrip.destination}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell>{formatDate(transfer.createdAt)}</TableCell>
                      <TableCell>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        {selectedTransfer && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalles de Transferencia</DialogTitle>
              <DialogDescription>
                Información completa sobre la transferencia del pasajero
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Pasajero</h4>
                  <p>{selectedTransfer.passengerName}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Estado</h4>
                  <div>{getStatusBadge(selectedTransfer.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Empresa origen</h4>
                  <p>{selectedTransfer.sourceCompanyName}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Empresa destino</h4>
                  <p>{selectedTransfer.targetCompanyName}</p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium text-sm mb-3">Viaje Original</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Número de viaje:</span> {selectedTransfer.sourceTrip.tripNumber}
                  </div>
                  <div>
                    <span className="font-medium">Fecha:</span> {formatDate(selectedTransfer.sourceTrip.departureDate)}
                  </div>
                  <div>
                    <span className="font-medium">Origen:</span> {selectedTransfer.sourceTrip.origin}
                  </div>
                  <div>
                    <span className="font-medium">Destino:</span> {selectedTransfer.sourceTrip.destination}
                  </div>
                  <div>
                    <span className="font-medium">Hora de salida:</span> {formatTime(selectedTransfer.sourceTrip.departureTime)}
                  </div>
                </div>
              </div>

              {selectedTransfer.targetTrip && (
                <div className="bg-muted p-4 rounded-md">
                  <h4 className="font-medium text-sm mb-3">Viaje de Destino</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Número de viaje:</span> {selectedTransfer.targetTrip.tripNumber}
                    </div>
                    <div>
                      <span className="font-medium">Fecha:</span> {formatDate(selectedTransfer.targetTrip.departureDate)}
                    </div>
                    <div>
                      <span className="font-medium">Origen:</span> {selectedTransfer.targetTrip.origin}
                    </div>
                    <div>
                      <span className="font-medium">Destino:</span> {selectedTransfer.targetTrip.destination}
                    </div>
                    <div>
                      <span className="font-medium">Hora de salida:</span> {formatTime(selectedTransfer.targetTrip.departureTime)}
                    </div>
                  </div>
                </div>
              )}

              {selectedTransfer.notes && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Notas</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                    {selectedTransfer.notes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">Fecha de creación</h4>
                  <p>{formatDate(selectedTransfer.createdAt)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-1">Fecha de completado</h4>
                  <p>{formatDate(selectedTransfer.completedAt)}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}