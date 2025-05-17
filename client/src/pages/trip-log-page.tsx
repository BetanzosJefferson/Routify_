import TripSummary from "@/components/trip-summary/trip-summary";
import { DefaultLayout } from "@/components/layout/default-layout";

export default function TripLogPageRoute() {
  return (
    <DefaultLayout activeTab="trip-summary">
      <TripSummary />
    </DefaultLayout>
  );
}