"""Shared Domain Enums for AISRestroOS."""

from enum import Enum


class OrderType(str, Enum):
    DINE_IN = "dine_in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"


class OrderStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    OTHER = "other"


class TableStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"


class KOTStatus(str, Enum):
    UNPRINTED = "unprinted"
    PRINTED = "printed"
    REPRINTED = "reprinted"


class InvoiceStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"


class TaxType(str, Enum):
    CGST_SGST = "CGST_SGST"
    VAT = "VAT"
    COMPOSITE = "COMPOSITE"
