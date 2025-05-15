import { useState } from 'react';
import { CompanyLinkCreator } from '@/components/transfers/company-link-creator';
import { CompanyLinkList } from '@/components/transfers/company-link-list';
import { TransferRequestsList } from '@/components/transfers/transfer-requests-list';
import { TransferHistoryList } from '@/components/transfers/transfer-history-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/use-auth';

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState('links');
  const { user } = useAuth();
  const isOwner = user?.role === 'dueño';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Helmet>
        <title>Transferencias | TransRoute</title>
      </Helmet>
      
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Transferencias entre Empresas</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las transferencias de pasajeros entre empresas vinculadas
        </p>
      </header>

      <Tabs 
        defaultValue="links" 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="links">Vínculos Empresariales</TabsTrigger>
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="space-y-6 mt-6">
          {isOwner && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CompanyLinkCreator />
              <CompanyLinkList />
            </div>
          )}
          {!isOwner && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                Solo los usuarios con rol de dueño pueden gestionar vínculos entre empresas.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-6 mt-6">
          <TransferRequestsList />
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <TransferHistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
}