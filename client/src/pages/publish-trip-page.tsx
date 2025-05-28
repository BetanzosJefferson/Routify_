import { PublishTripForm } from "@/components/publish-trip/publish-trip-form";
import DefaultLayout from "@/components/layout/default-layout";

export default function PublishTripPageRoute() {
  return (
    <DefaultLayout activeTab="publish-trip">
      <PublishTripForm />
    </DefaultLayout>
  );
}