import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { useApiMutation } from '../../hooks/useApi';
import { formatCurrency, todayIso } from '../../utils/format';

/** Money in from a buyer (kind="buyer") or out to a supplier (kind="supplier") against one bill. */
export function RecordPaymentModal({ kind, bill, onClose }) {
  const [form, setForm] = useState({ amount: '', method: 'BANK_TRANSFER', reference: '', paidOn: todayIso() });
  useEffect(() => {
    if (bill) setForm({ amount: String(bill.balance_due), method: 'BANK_TRANSFER', reference: '', paidOn: todayIso() });
  }, [bill]);
  const isBuyerPayment = kind === 'buyer';
  const record = useApiMutation({
    path: isBuyerPayment ? '/finance/buyer-payments' : '/finance/supplier-payments',
    invalidate: ['/finance', '/dashboard', '/reports', '/dispatches', '/inventory', '/buyers', '/suppliers'],
    successMessage: 'Payment recorded',
    onSuccess: onClose,
  });
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      isOpen={Boolean(bill)}
      onClose={onClose}
      title={isBuyerPayment ? 'Payment received' : 'Pay supplier'}
      subtitle={bill ? `${bill.invoice_number ?? bill.receipt_number} · ${bill.buyer_name ?? bill.supplier_name} · balance ${formatCurrency(bill.balance_due)}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={record.isPending}
            disabled={!(Number(form.amount) > 0)}
            onClick={() =>
              record.mutate({
                body: {
                  [isBuyerPayment ? 'invoiceId' : 'yarnReceiptId']: bill.id,
                  amount: Number(form.amount),
                  method: form.method,
                  reference: form.reference || null,
                  paidOn: form.paidOn,
                },
              })
            }
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <FormField label="Amount (₹)" error={Number(form.amount) > (bill?.balance_due ?? 0) ? 'More than the balance due' : undefined}>
          <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField('amount')} />
        </FormField>
        <FormField label="Date">
          <input className="input" type="date" max={todayIso()} value={form.paidOn} onChange={updateField('paidOn')} />
        </FormField>
        <FormField label="Method">
          <select className="select" value={form.method} onChange={updateField('method')}>
            <option value="BANK_TRANSFER">Bank transfer (NEFT/RTGS)</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
          </select>
        </FormField>
        <FormField label="Reference">
          <input className="input" value={form.reference} onChange={updateField('reference')} placeholder="UTR / cheque no." maxLength={60} />
        </FormField>
      </div>
    </Modal>
  );
}
