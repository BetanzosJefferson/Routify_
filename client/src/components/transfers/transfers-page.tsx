import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import TransfersList from "./transfers-list";
import NewTransferModal from "./new-transfer-modal";

const TransfersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  // Consultar las transferencias
  const { 
    data: transfers, 
    isLoading,
    refetch 
  } = useQuery({ 
    queryKey: ["/api/transfers", statusFilter], 
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/transfers${queryString}`);
      
      if (!response.ok) {
        throw new Error("Error al cargar transferencias");
      }
      
      return response.json();
    },
    refetchOnWindowFocus: false
  });

  const handleCreateTransfer = () => {
    setIsCreateModalOpen(true);
  };

  const handleTransferCreated = () => {
    toast({
      title: "Transferencia creada",
      description: "La solicitud de transferencia ha sido creada exitosamente",
    });
    refetch();
    setIsCreateModalOpen(false);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!transfers || transfers.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-muted-foreground mb-4">No hay transferencias disponibles</p>
          <Button onClick={handleCreateTransfer}>Crear transferencia</Button>
        </div>
      );
    }

    let filteredTransfers = [...transfers];
    
    // Filtrar según la pestaña activa
    if (activeTab === "outgoing") {
      filteredTransfers = filteredTransfers.filter(
        t => t.sourceCompanyId === user?.companyId
      );
    } else if (activeTab === "incoming") {
      filteredTransfers = filteredTransfers.filter(
        t => t.targetCompanyId === user?.companyId
      );
    }

    return (
      <TransfersList 
        transfers={filteredTransfers} 
        onRefresh={refetch}
      />
    );
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transferencias entre compañías</CardTitle>
            <CardDescription>
              Gestiona las transferencias de viajes y reservaciones entre compañías
            </CardDescription>
          </div>
          <Button onClick={handleCreateTransfer}>Nueva transferencia</Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
            <Tabs 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full md:w-auto"
            >
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="outgoing">Salientes</TabsTrigger>
                <TabsTrigger value="incoming">Entrantes</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="w-full md:w-auto">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {renderContent()}
        </CardContent>
      </Card>

      <NewTransferModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTransferCreated={handleTransferCreated}
      />
    </div>
  );
};

export default TransfersPage;