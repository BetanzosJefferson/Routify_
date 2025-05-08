import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useParams } from "wouter";
import { EditTripForm } from "@/components/publish-trip/edit-trip-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

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

  return (
    <>
      <Helmet>
        <title>Editar Viaje | TransRoute</title>
      </Helmet>

      <div className="container mx-auto py-8">
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
    </>
  );
}