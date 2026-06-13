// Shared phase logic for the payment modals.
// Orders poll /api/orders/{id} (Order statuses: PendingPayment / EscrowLocked / Cancelled …);
// wallet top-ups poll /api/wallet/topup/{id} (WalletTxn statuses: Pending / Completed / Failed).
export function isPaymentDone(status: string): { done: boolean; failed: boolean } {
  const pending = status === "PendingPayment" || status === "Pending";
  const failed = status === "Cancelled" || status === "Failed";
  return { done: !pending, failed };
}
