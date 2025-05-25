import { PassengerTransferPage } from "@/components/passenger-transfer/passenger-transfer-page";
import DefaultLayout from "@/components/layout/default-layout";

export default function PassengerTransferPageRoute() {
  return (
    <DefaultLayout activeTab="passenger-transfer">
      <PassengerTransferPage />
    </DefaultLayout>
  );
}