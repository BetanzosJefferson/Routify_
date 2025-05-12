import { CashRegisterPage } from "@/components/cash-register/cash-register-page";
import { DefaultLayout } from "@/components/layout/default-layout";

export default function CashRegisterPageRoute() {
  return (
    <DefaultLayout activeTab="cash-register">
      <CashRegisterPage />
    </DefaultLayout>
  );
}