import React from "react";
import DefaultLayout from "@/components/layout/default-layout";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const CutoffHistoryPage: React.FC = () => {
  // Verificar autenticación
  const { user, loading } = useRequireAuth();

  if (loading) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center h-64">
          <p>Cargando...</p>
        </div>
      </DefaultLayout>
    );
  }

  if (!user) {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center h-64">
          <p>Debe iniciar sesión para acceder a esta página</p>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Historial de Cortes</h1>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Cortes de Caja</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center text-gray-500">
                Esta funcionalidad estará disponible próximamente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DefaultLayout>
  );
};

export default CutoffHistoryPage;