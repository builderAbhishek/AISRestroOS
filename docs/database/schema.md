# Database Schema & Data Models

AISRestroOS utilizes SQLite with SQLAlchemy 2.0 ORM and Alembic migrations.

## 1. Entities & Relationships

### `restaurants`
- `id`: UUID (String 36, PK)
- `name`: Trade name (String 120)
- `legal_name`: Legal company name (String 150)
- `owner_name`: Primary contact (String 100)
- `phone`: Contact phone (String 20)
- `email`: Optional email (String 100)
- `address`: Physical address (Text)
- `currency`: Default "INR"
- `currency_symbol`: Default "₹"
- `gst_registered`: Boolean
- `gstin`: 15-char GSTIN string

### `restaurant_settings`
- `restaurant_id`: FK -> `restaurants.id`
- `tax_rate_percent`: Default 5.0%
- `tax_type`: "CGST_SGST", "VAT", "COMPOSITE"
- `order_types_json`: '["dine_in", "takeaway", "delivery"]'
- `kot_printer_name`: Thermal printer name
- `bill_printer_name`: Receipt printer name
- `paper_width_mm`: 80 or 58
- `invoice_prefix`: Default "INV-"
- `kot_prefix`: Default "KOT-"
- `bill_footer_text`: Custom greeting text

### `menu_categories`
- `id`: UUID (PK)
- `restaurant_id`: FK -> `restaurants.id`
- `name`: Category title (e.g. Starters, Main Course)
- `sort_order`: Integer
- `is_active`: Boolean

### `menu_items`
- `id`: UUID (PK)
- `category_id`: FK -> `menu_categories.id`
- `name`: Dish name (e.g. Butter Chicken)
- `item_code`: Short code (e.g. MC-01)
- `base_price_paise`: Integer paise (e.g. 24000 = ₹240.00)
- `is_veg`: Boolean
- `is_available`: Boolean
- `has_variants`: Boolean

### `menu_variants`
- `id`: UUID (PK)
- `item_id`: FK -> `menu_items.id`
- `name`: Portion name (e.g. Half, Full, Regular, Large)
- `price_paise`: Integer paise

### `addon_groups` & `addons`
- Groups: e.g. "Spice Level", "Extra Cheese"
- Addons: Name and additional price in paise

### `restaurant_tables`
- `id`: UUID (PK)
- `table_number`: e.g. "T1", "Garden-4"
- `capacity`: Seating capacity
- `section`: "Ground Floor", "Family Section", "Outdoor"
- `status`: "available" | "occupied" | "reserved"
- `current_order_id`: UUID nullable

### `orders`
- `id`: UUID (PK)
- `order_number`: Integer sequential
- `order_code`: Formatted e.g. "ORD-0001"
- `order_type`: "dine_in" | "takeaway" | "delivery"
- `table_id`: FK -> `restaurant_tables.id` (nullable)
- `table_number_snapshot`: String (immutable)
- `status`: "active" | "completed" | "cancelled"
- `subtotal_paise`, `discount_paise`, `cgst_paise`, `sgst_paise`, `tax_paise`, `total_paise`

### `order_items`
- `order_id`: FK -> `orders.id`
- `menu_item_id`: FK
- `variant_id`: FK nullable
- `item_name`: Snapshot string
- `variant_name`: Snapshot string
- `unit_price_paise`: Snapshot price
- `quantity`: Integer
- `line_total_paise`: Integer
- `notes`: Kitchen notes
- `kot_status`: "unprinted" | "printed"
- `printed_quantity`: Tracked portions printed to kitchen

### `kots` & `kot_items`
- Stores incremental tickets sent to kitchen. Each KOT records only the newly added items or incremental quantities.

### `invoices` & `payments`
- Final settled invoice with snapshot tax breakdown.
- Multi-payment tracking: supports Cash, UPI, Card, Other, and Split payments.

## 2. WAL Configuration
SQLite Write-Ahead Logging (`WAL`) allows concurrent readers without blocking writers:
- `PRAGMA journal_mode = WAL;`
- `PRAGMA synchronous = NORMAL;`
- `PRAGMA busy_timeout = 5000;`
- `PRAGMA foreign_keys = ON;`
