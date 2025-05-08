import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { EditTripForm } from "@/components/publish-trip/edit-trip-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { TabType } from "@/hooks/use-active-tab";

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>();
  const [tripId, setTripId] = useState<number | null>(null);

  // Convertir el id a número cuando el componente se monta
  useEffect(() => {
    if (id) {
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        setTripId(numericId);
      }
    }
  }, [id]);

  const [activeTab, setActiveTab] = useState<TabType>("publish-trip");
  
  // Tab change handler
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="container mx-auto">
              <Card className="bg-white shadow-md">
                <CardHeader className="border-b bg-muted/40">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center">
                      <Button 
                        variant="ghost" 
                        className="mr-2 h-8 w-8 p-0"
                        onClick={() => window.location.href = '/publish'}
                      >
                        <ArrowLeftIcon className="h-4 w-4" />
                      </Button>
                      <CardTitle>Editar Viaje</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {tripId ? (
                    <EditTripForm tripId={tripId} />
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-lg text-gray-500">
                        No se encontró el viaje especificado.
                      </p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => window.location.href = '/publish'}
                      >
                        Volver a Viajes Publicados
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}