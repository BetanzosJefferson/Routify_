import React from "react";
import DefaultLayout from "@/components/layout/default-layout";
import TransactionHistoryBox from "@/components/cutoff-history/transaction-history-box";
import { useRequireAuth } from "@/hooks/use-require-auth";

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
        <h1 className="text-3xl font-bold mb-6">Historial de cortes</h1>
        <div className="space-y-6">
          <TransactionHistoryBox />
        </div>
      </div>
    </DefaultLayout>
  );
};

export default CutoffHistoryPage;