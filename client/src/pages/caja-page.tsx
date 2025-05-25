import { DefaultLayout } from "@/components/layout/default-layout";

export function CajaPage() {
  return (
    <DefaultLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Caja</h1>
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <p className="text-gray-600 dark:text-gray-300">
            Módulo de Caja en desarrollo.
          </p>
        </div>
      </div>
    </DefaultLayout>
  );
}