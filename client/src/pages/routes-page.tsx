import { RouteList } from "@/components/create-route/route-list";
import DefaultLayout from "@/components/layout/default-layout";

export default function RoutesPageRoute() {
  return (
    <DefaultLayout activeTab="create-route">
      <RouteList />
    </DefaultLayout>
  );
}