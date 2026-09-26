
export interface InvoiceData {
  invoiceId: string;
  paymentId: string;
  providerTrxId?: string;
  merchantInvoiceNumber: string;
  citizenName: string;
  citizenEmail: string;
  requestNumber?: string;
  requestTitle?: string;
  paidAt: string;
  amount: string;
  currency: string;
  provider: string;
  status: string;
}

export interface InvoiceResult {
  invoiceUrl: string;
  invoicePublicId: string;
}
