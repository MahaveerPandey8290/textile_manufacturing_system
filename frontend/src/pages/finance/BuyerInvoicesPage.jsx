import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { InvoicesTable } from './FinancePage';

export default function BuyerInvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" description="Every invoice raised against your orders and what is still due." />
      <Card>
        <InvoicesTable readOnly />
      </Card>
    </>
  );
}
