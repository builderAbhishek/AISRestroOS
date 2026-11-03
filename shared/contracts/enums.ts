export enum OrderType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
  DELIVERY = 'delivery',
}

export enum OrderStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  UPI = 'upi',
  CARD = 'card',
  OTHER = 'other',
}

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
}

export enum KOTStatus {
  UNPRINTED = 'unprinted',
  PRINTED = 'printed',
  REPRINTED = 'reprinted',
}

export enum InvoiceStatus {
  UNPAID = 'unpaid',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
}

export enum TaxType {
  CGST_SGST = 'CGST_SGST',
  VAT = 'VAT',
  COMPOSITE = 'COMPOSITE',
}
