import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CompanyLinkCreator } from '@/components/transfers/company-link-creator';
import { CompanyLinkList } from '@/components/transfers/company-link-list';
import { TransferRequestsList } from '@/components/transfers/transfer-requests-list';
import { TransferHistoryList } from '@/components/transfers/transfer-history-list';
import { useToast } from '@/hooks/use-toast';
import { Helmet } from 'react-helmet-async';

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState('vinculos');
  const { toast } = useToast();

  return (
    <div className="container p-6">
      <Helmet>
        <title>Transferencias entre Empresas | TransRoute</title>
      </Helmet>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transferencias entre Empresas</h1>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sistema de Transferencias</CardTitle>
          <CardDescription>
            Gestiona vínculos entre empresas y coordina la transferencia de pasajeros de manera eficiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            El sistema de transferencias permite a empresas colaborar para ofrecer un mejor servicio a los pasajeros,
            facilitando el traslado de pasajeros entre diferentes empresas cuando sea necesario, manteniendo
            toda la información de reservas y garantizando una experiencia fluida.
          </p>
        </CardContent>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="vinculos">Vínculos Empresariales</TabsTrigger>
          <TabsTrigger value="solicitudes">Solicitudes de Transferencia</TabsTrigger>
          <TabsTrigger value="historial">Historial de Transferencias</TabsTrigger>
        </TabsList>
        
        <TabsContent value="vinculos" className="mt-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <CompanyLinkCreator />
            <CompanyLinkList />
          </div>
        </TabsContent>
        
        <TabsContent value="solicitudes" className="mt-4">
          <TransferRequestsList />
        </TabsContent>
        
        <TabsContent value="historial" className="mt-4">
          <TransferHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}