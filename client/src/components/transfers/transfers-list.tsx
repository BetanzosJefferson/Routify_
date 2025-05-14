import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Eye } from "lucide-react";
import TransferDetailsModal from "./transfer-details-modal";

interface Transfer {
  id: number;
  sourceCompanyId: string | null;
  targetCompanyId: string | null;
  tripId: number;
  status: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
  sourceCompanyName: string;
  targetCompanyName: string;
  tripDetails: {
    departureDate: Date;
    departureTime: string;
    origin: string;
    destination: string;
  };
  reservationCount: number;
}

interface TransfersListProps {
  transfers: Transfer[];
  onRefresh: () => void;
}

const TransfersList = ({ transfers, onRefresh }: TransfersListProps) => {
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleViewDetails = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: es });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 bg-opacity-50">Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rechazada</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Ordenar las transferencias
  const sortedTransfers = [...transfers].sort((a, b) => {
    if (sortField === "createdAt" || sortField === "updatedAt") {
      const dateA = new Date(a[sortField as keyof Transfer] as Date).getTime();
      const dateB = new Date(b[sortField as keyof Transfer] as Date).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    } else if (sortField === "departureDate") {
      const dateA = new Date(a.tripDetails.departureDate).getTime();
      const dateB = new Date(b.tripDetails.departureDate).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    } else {
      const valA = a[sortField as keyof Transfer];
      const valB = b[sortField as keyof Transfer];
      
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc" 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      
      // Comparación por reservationCount
      if (sortField === "reservationCount") {
        return sortDirection === "asc" 
          ? (a.reservationCount - b.reservationCount)
          : (b.reservationCount - a.reservationCount);
      }
      
      return 0;
    }
  });

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("sourceCompanyName")}
                >
                  Origen
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("targetCompanyName")}
                >
                  Destino
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("departureDate")}
                >
                  Viaje
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("reservationCount")}
                >
                  Reservas
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  Estado
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => handleSort("createdAt")}
                >
                  Fecha
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">{transfer.id}</TableCell>
                <TableCell>{transfer.sourceCompanyName}</TableCell>
                <TableCell>{transfer.targetCompanyName}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {formatDate(transfer.tripDetails.departureDate)}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-col sm:flex-row gap-1">
                      <span>{transfer.tripDetails.origin}</span>
                      <span className="hidden sm:inline">→</span>
                      <span>{transfer.tripDetails.destination}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{transfer.reservationCount}</TableCell>
                <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm">
                      {formatDate(transfer.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(transfer.createdAt), "HH:mm", { locale: es })}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(transfer)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver detalles
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedTransfer && (
        <TransferDetailsModal
          isOpen={!!selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          transfer={selectedTransfer}
          onTransferUpdated={onRefresh}
        />
      )}
    </div>
  );
};

export default TransfersList;