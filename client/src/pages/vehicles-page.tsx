import { VehiclesPage } from "@/components/vehicles/vehicles-page";
import DefaultLayout from "@/components/layout/default-layout";

export default function VehiclesPageRoute() {
  return (
    <DefaultLayout activeTab="vehicles">
      <VehiclesPage />
    </DefaultLayout>
  );
}