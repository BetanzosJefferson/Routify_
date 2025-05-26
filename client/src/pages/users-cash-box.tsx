import React from "react";
import DefaultLayout from "@/components/layout/default-layout";
import UsersCashBoxComponent from "@/components/cash-box/users-cash-box";
import { useRequireAuth } from "@/hooks/use-require-auth";

const UsersCashBoxPage: React.FC = () => {
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

  // Verificar que el usuario tenga los permisos necesarios (dueño o admin)
  if (user.role !== "dueño" && user.role !== "admin") {
    return (
      <DefaultLayout>
        <div className="flex justify-center items-center h-64">
          <p>No tiene permisos para acceder a esta página</p>
        </div>
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Caja de usuarios</h1>
        <div className="space-y-6">
          <UsersCashBoxComponent />
        </div>
      </div>
    </DefaultLayout>
  );
};

export default UsersCashBoxPage;