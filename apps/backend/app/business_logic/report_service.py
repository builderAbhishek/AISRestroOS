from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from app.models.order import Order, OrderItem
from app.models.billing import Invoice, Payment, Refund
from app.models.menu import MenuItem, MenuCategory
from app.models.inventory import InventoryItem, StockMovement, WastageRecord, Recipe
from app.core.logging import logger


def resolve_date_range(
    range_type: str = "today",
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
) -> Tuple[datetime, datetime, datetime, datetime]:
    """
    Resolves standard date range filters and their preceding comparison periods.
    Returns (current_start, current_end, previous_start, previous_end).
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    if range_type == "today":
        start_dt = today_start
        end_dt = today_end
        prev_start = start_dt - timedelta(days=1)
        prev_end = end_dt - timedelta(days=1)

    elif range_type == "yesterday":
        start_dt = today_start - timedelta(days=1)
        end_dt = today_end - timedelta(days=1)
        prev_start = start_dt - timedelta(days=1)
        prev_end = end_dt - timedelta(days=1)

    elif range_type == "this_week":
        # Monday as start of week
        start_dt = today_start - timedelta(days=today_start.weekday())
        end_dt = today_end
        duration = end_dt - start_dt
        prev_start = start_dt - timedelta(days=7)
        prev_end = prev_start + duration

    elif range_type == "this_month":
        start_dt = today_start.replace(day=1)
        end_dt = today_end
        # Previous month
        last_day_prev_month = start_dt - timedelta(days=1)
        prev_start = last_day_prev_month.replace(day=1)
        prev_end = last_day_prev_month.replace(hour=23, minute=59, second=59, microsecond=999999)

    elif range_type == "last_month":
        first_this_month = today_start.replace(day=1)
        end_dt = (first_this_month - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=999999)
        start_dt = end_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day_two_months_ago = start_dt - timedelta(days=1)
        prev_start = last_day_two_months_ago.replace(day=1)
        prev_end = last_day_two_months_ago.replace(hour=23, minute=59, second=59, microsecond=999999)

    elif range_type == "custom" and custom_start and custom_end:
        try:
            start_dt = datetime.fromisoformat(custom_start.replace("Z", "+00:00"))
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except Exception:
            start_dt = today_start

        try:
            end_dt = datetime.fromisoformat(custom_end.replace("Z", "+00:00"))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        except Exception:
            end_dt = today_end

        duration = end_dt - start_dt
        prev_end = start_dt - timedelta(microseconds=1)
        prev_start = prev_end - duration
    else:
        start_dt = today_start
        end_dt = today_end
        prev_start = start_dt - timedelta(days=1)
        prev_end = end_dt - timedelta(days=1)

    return start_dt, end_dt, prev_start, prev_end


def get_executive_overview(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
    prev_start: datetime,
    prev_end: datetime,
) -> Dict[str, Any]:
    """
    Computes overarching KPI metrics for the selected time window and compares with previous period.
    """
    # Active/Completed orders in period
    orders_query = db.query(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.created_at >= start_dt,
        Order.created_at <= end_dt,
        Order.status != "cancelled",
    )
    orders = orders_query.all()

    total_orders_count = len(orders)
    gross_sales_paise = sum(o.subtotal_paise for o in orders)
    discount_paise = sum(o.discount_paise for o in orders)
    net_sales_paise = sum(o.taxable_amount_paise for o in orders)
    tax_paise = sum(o.tax_paise for o in orders)
    grand_total_paise = sum(o.grand_total_paise for o in orders)
    aov_paise = int(round(net_sales_paise / total_orders_count)) if total_orders_count > 0 else 0

    # Cancelled orders
    cancelled_count = (
        db.query(func.count(Order.id))
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status == "cancelled",
        )
        .scalar()
        or 0
    )

    # Payments collected in this period
    payments = (
        db.query(Payment)
        .join(Order, Payment.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Payment.created_at >= start_dt,
            Payment.created_at <= end_dt,
        )
        .all()
    )
    total_payments_collected_paise = sum(p.amount_paise for p in payments)

    # Refunds issued in this period
    refunds = (
        db.query(Refund)
        .join(Order, Refund.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Refund.created_at >= start_dt,
            Refund.created_at <= end_dt,
        )
        .all()
    )
    total_refunds_paise = sum(r.amount_paise for r in refunds)

    # Outstanding dues on orders placed in this period
    total_dues_paise = sum(o.due_amount_paise for o in orders)

    # Previous period comparison for growth %
    prev_orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= prev_start,
            Order.created_at <= prev_end,
            Order.status != "cancelled",
        )
        .all()
    )
    prev_net_sales = sum(o.taxable_amount_paise for o in prev_orders)
    prev_orders_count = len(prev_orders)

    sales_growth_pct = 0.0
    if prev_net_sales > 0:
        sales_growth_pct = round(((net_sales_paise - prev_net_sales) / prev_net_sales) * 100.0, 1)

    orders_growth_pct = 0.0
    if prev_orders_count > 0:
        orders_growth_pct = round(((total_orders_count - prev_orders_count) / prev_orders_count) * 100.0, 1)

    return {
        "start_date": start_dt.isoformat(),
        "end_date": end_dt.isoformat(),
        "total_orders_count": total_orders_count,
        "cancelled_orders_count": cancelled_count,
        "gross_sales_paise": gross_sales_paise,
        "discount_paise": discount_paise,
        "net_sales_paise": net_sales_paise,
        "tax_paise": tax_paise,
        "grand_total_paise": grand_total_paise,
        "aov_paise": aov_paise,
        "payments_collected_paise": total_payments_collected_paise,
        "refunds_issued_paise": total_refunds_paise,
        "outstanding_dues_paise": total_dues_paise,
        "sales_growth_pct": sales_growth_pct,
        "orders_growth_pct": orders_growth_pct,
    }


def get_sales_trend(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    """
    Generates daily trend points across the selected interval.
    """
    orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .order_by(Order.created_at.asc())
        .all()
    )

    # Group by date YYYY-MM-DD
    grouped: Dict[str, Dict[str, Any]] = {}
    for o in orders:
        d_str = o.created_at.strftime("%Y-%m-%d") if o.created_at else "Unknown"
        if d_str not in grouped:
            grouped[d_str] = {
                "date": d_str,
                "orders_count": 0,
                "gross_sales_paise": 0,
                "discount_paise": 0,
                "net_sales_paise": 0,
                "tax_paise": 0,
                "grand_total_paise": 0,
            }
        grouped[d_str]["orders_count"] += 1
        grouped[d_str]["gross_sales_paise"] += o.subtotal_paise
        grouped[d_str]["discount_paise"] += o.discount_paise
        grouped[d_str]["net_sales_paise"] += o.taxable_amount_paise
        grouped[d_str]["tax_paise"] += o.tax_paise
        grouped[d_str]["grand_total_paise"] += o.grand_total_paise

    return list(grouped.values())


def get_item_wise_sales(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    """
    Aggregates quantities, variants, and sales value per menu item.
    """
    items = (
        db.query(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .all()
    )

    aggregated: Dict[str, Dict[str, Any]] = {}
    for oi in items:
        key = f"{oi.menu_item_id}_{oi.variant_id or 'none'}"
        if key not in aggregated:
            aggregated[key] = {
                "menu_item_id": oi.menu_item_id,
                "item_name": oi.item_name,
                "variant_id": oi.variant_id,
                "variant_name": oi.variant_name,
                "quantity_sold": 0,
                "total_sales_paise": 0,
            }
        aggregated[key]["quantity_sold"] += oi.quantity
        aggregated[key]["total_sales_paise"] += oi.line_total_paise

    result = list(aggregated.values())
    result.sort(key=lambda x: x["total_sales_paise"], reverse=True)
    return result


def get_category_wise_sales(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    """
    Computes revenue and volume distribution across menu categories.
    """
    items = (
        db.query(OrderItem, MenuItem)
        .join(Order, OrderItem.order_id == Order.id)
        .outerjoin(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .all()
    )

    cat_map: Dict[str, str] = {
        c.id: c.name
        for c in db.query(MenuCategory).filter(MenuCategory.restaurant_id == restaurant_id).all()
    }

    aggregated: Dict[str, Dict[str, Any]] = {}
    total_revenue = 0

    for oi, m_item in items:
        cat_id = m_item.category_id if m_item else "uncategorized"
        cat_name = cat_map.get(cat_id, "Uncategorized") if cat_id else "Uncategorized"

        if cat_name not in aggregated:
            aggregated[cat_name] = {
                "category_name": cat_name,
                "quantity_sold": 0,
                "total_sales_paise": 0,
                "percentage": 0.0,
            }
        aggregated[cat_name]["quantity_sold"] += oi.quantity
        aggregated[cat_name]["total_sales_paise"] += oi.line_total_paise
        total_revenue += oi.line_total_paise

    results = list(aggregated.values())
    for r in results:
        if total_revenue > 0:
            r["percentage"] = round((r["total_sales_paise"] / total_revenue) * 100.0, 1)

    results.sort(key=lambda x: x["total_sales_paise"], reverse=True)
    return results


def get_order_type_sales(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    """
    Breaks down sales and volume by Dine-in, Takeaway, and Delivery.
    """
    orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .all()
    )

    types = {"dine_in": "Dine In", "takeaway": "Takeaway", "delivery": "Delivery"}
    aggregated: Dict[str, Dict[str, Any]] = {
        k: {"order_type": k, "label": v, "orders_count": 0, "net_sales_paise": 0, "grand_total_paise": 0, "percentage": 0.0}
        for k, v in types.items()
    }

    total_sales = 0
    for o in orders:
        otype = o.order_type if o.order_type in aggregated else "dine_in"
        aggregated[otype]["orders_count"] += 1
        aggregated[otype]["net_sales_paise"] += o.taxable_amount_paise
        aggregated[otype]["grand_total_paise"] += o.grand_total_paise
        total_sales += o.grand_total_paise

    results = list(aggregated.values())
    for r in results:
        if total_sales > 0:
            r["percentage"] = round((r["grand_total_paise"] / total_sales) * 100.0, 1)

    return results


def get_payment_methods_report(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """
    Aggregates real payment collections across payment methods (Cash, UPI, Card, Other).
    """
    payments = (
        db.query(Payment)
        .join(Order, Payment.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Payment.created_at >= start_dt,
            Payment.created_at <= end_dt,
        )
        .all()
    )

    methods: Dict[str, Dict[str, Any]] = {
        "cash": {"method": "cash", "label": "Cash", "count": 0, "amount_paise": 0, "percentage": 0.0},
        "upi": {"method": "upi", "label": "UPI / QR", "count": 0, "amount_paise": 0, "percentage": 0.0},
        "card": {"method": "card", "label": "Card", "count": 0, "amount_paise": 0, "percentage": 0.0},
        "other": {"method": "other", "label": "Other", "count": 0, "amount_paise": 0, "percentage": 0.0},
    }

    total_amount = 0
    for p in payments:
        m = p.payment_method.lower() if p.payment_method else "other"
        if m not in methods:
            m = "other"
        methods[m]["count"] += 1
        methods[m]["amount_paise"] += p.amount_paise
        total_amount += p.amount_paise

    method_list = list(methods.values())
    for item in method_list:
        if total_amount > 0:
            item["percentage"] = round((item["amount_paise"] / total_amount) * 100.0, 1)

    return {
        "total_collected_paise": total_amount,
        "payment_count": len(payments),
        "breakdown": method_list,
    }


def get_tax_report(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """
    Gathers immutable tax figures from invoices for GST compliance.
    """
    invoices = (
        db.query(Invoice)
        .join(Order, Invoice.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
            Invoice.status != "cancelled",
        )
        .order_by(Invoice.created_at.desc())
        .all()
    )

    taxable_paise = sum(inv.taxable_amount_paise for inv in invoices)
    cgst_paise = sum(inv.cgst_paise for inv in invoices)
    sgst_paise = sum(inv.sgst_paise for inv in invoices)
    igst_paise = sum(inv.igst_paise for inv in invoices)
    total_tax_paise = sum(inv.total_tax_paise for inv in invoices)
    grand_total_paise = sum(inv.grand_total_paise for inv in invoices)

    invoice_entries = [
        {
            "invoice_number": inv.invoice_number,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "taxable_amount_paise": inv.taxable_amount_paise,
            "cgst_paise": inv.cgst_paise,
            "sgst_paise": inv.sgst_paise,
            "igst_paise": inv.igst_paise,
            "total_tax_paise": inv.total_tax_paise,
            "grand_total_paise": inv.grand_total_paise,
            "status": inv.status,
        }
        for inv in invoices
    ]

    return {
        "taxable_amount_paise": taxable_paise,
        "cgst_paise": cgst_paise,
        "sgst_paise": sgst_paise,
        "igst_paise": igst_paise,
        "total_tax_paise": total_tax_paise,
        "grand_total_paise": grand_total_paise,
        "invoices_count": len(invoices),
        "invoices": invoice_entries,
    }


def get_inventory_analytics_report(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """
    Inventory valuation, consumption, wastage, and low stock analytics.
    """
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.restaurant_id == restaurant_id)
        .all()
    )

    total_stock_value_paise = sum(
        int(round(item.current_stock * item.cost_per_unit_paise))
        for item in items
    )
    low_stock_items = [
        {
            "id": item.id,
            "name": item.name,
            "sku": item.sku,
            "unit": item.unit,
            "current_stock": item.current_stock,
            "reorder_level": item.reorder_level,
            "cost_per_unit_paise": item.cost_per_unit_paise,
        }
        for item in items
        if item.current_stock <= item.reorder_level
    ]

    # Movements in the period
    movements = (
        db.query(StockMovement)
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(
            InventoryItem.restaurant_id == restaurant_id,
            StockMovement.created_at >= start_dt,
            StockMovement.created_at <= end_dt,
        )
        .all()
    )

    consumption_cost_paise = sum(
        m.total_cost_paise for m in movements if m.movement_type == "SALE_CONSUMPTION"
    )
    purchases_cost_paise = sum(
        m.total_cost_paise for m in movements if m.movement_type == "PURCHASE_IN"
    )
    wastage_cost_paise = sum(
        m.total_cost_paise for m in movements if m.movement_type == "WASTAGE"
    )

    # Wastage breakdown
    wastage_records = (
        db.query(WastageRecord)
        .filter(
            WastageRecord.restaurant_id == restaurant_id,
            WastageRecord.created_at >= start_dt,
            WastageRecord.created_at <= end_dt,
        )
        .all()
    )
    wastage_list = [
        {
            "id": w.id,
            "item_name": w.inventory_item.name if w.inventory_item else "Unknown",
            "quantity": w.quantity,
            "unit": w.inventory_item.unit if w.inventory_item else "",
            "cost_paise": w.cost_paise,
            "reason": w.reason,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in wastage_records
    ]

    return {
        "total_items_count": len(items),
        "total_stock_value_paise": total_stock_value_paise,
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items,
        "purchases_cost_paise": purchases_cost_paise,
        "consumption_cost_paise": consumption_cost_paise,
        "wastage_cost_paise": wastage_cost_paise,
        "wastage_records": wastage_list,
    }


def get_profitability_report(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """
    Computes Gross Profit = Net Sales - COGS (Recipe-based cost of goods sold).
    Transparently reports the recipe mapping coverage percentage so user is aware if some items lack recipes.
    """
    orders = (
        db.query(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .all()
    )

    net_sales_paise = sum(o.taxable_amount_paise for o in orders)

    # Calculate COGS from StockMovements for SALE_CONSUMPTION in this period
    cogs_movements = (
        db.query(StockMovement)
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(
            InventoryItem.restaurant_id == restaurant_id,
            StockMovement.created_at >= start_dt,
            StockMovement.created_at <= end_dt,
            StockMovement.movement_type == "SALE_CONSUMPTION",
        )
        .all()
    )
    total_cogs_paise = sum(m.total_cost_paise for m in cogs_movements)

    # Check recipe coverage across ordered menu items
    all_order_items = (
        db.query(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_dt,
            Order.created_at <= end_dt,
            Order.status != "cancelled",
        )
        .all()
    )

    all_recipes = (
        db.query(Recipe)
        .filter(Recipe.restaurant_id == restaurant_id)
        .all()
    )
    recipe_item_ids = {r.menu_item_id for r in all_recipes}

    mapped_sales_paise = 0
    total_item_sales_paise = 0
    for oi in all_order_items:
        total_item_sales_paise += oi.line_total_paise
        if oi.menu_item_id in recipe_item_ids:
            mapped_sales_paise += oi.line_total_paise

    recipe_coverage_pct = 0.0
    if total_item_sales_paise > 0:
        recipe_coverage_pct = round((mapped_sales_paise / total_item_sales_paise) * 100.0, 1)

    gross_profit_paise = net_sales_paise - total_cogs_paise
    gross_margin_pct = 0.0
    if net_sales_paise > 0:
        gross_margin_pct = round((gross_profit_paise / net_sales_paise) * 100.0, 1)

    return {
        "net_sales_paise": net_sales_paise,
        "cogs_paise": total_cogs_paise,
        "gross_profit_paise": gross_profit_paise,
        "gross_margin_pct": gross_margin_pct,
        "recipe_coverage_pct": recipe_coverage_pct,
        "disclaimer": (
            f"Gross profit reflects Net Sales minus ingredient COGS for mapped recipes ({recipe_coverage_pct}% coverage). "
            "Fixed operational overheads (rent, salaries, electricity) are not deducted."
        ),
    }


def get_cash_flow_report(
    db: Session,
    restaurant_id: str,
    start_dt: datetime,
    end_dt: datetime,
) -> Dict[str, Any]:
    """Generates shift-wise and aggregated cash flow report."""
    from app.models.cash import CashRegisterShift, Expense

    shifts = (
        db.query(CashRegisterShift)
        .filter(
            CashRegisterShift.restaurant_id == restaurant_id,
            CashRegisterShift.opened_at >= start_dt,
            CashRegisterShift.opened_at <= end_dt,
        )
        .order_by(CashRegisterShift.opened_at.desc())
        .all()
    )

    expenses = (
        db.query(Expense)
        .filter(
            Expense.restaurant_id == restaurant_id,
            Expense.expense_date >= start_dt,
            Expense.expense_date <= end_dt,
        )
        .all()
    )

    total_opening_paise = sum(s.opening_cash_paise for s in shifts)
    total_cash_sales_paise = sum(s.cash_sales_paise for s in shifts)
    total_cash_in_paise = sum(s.cash_in_paise for s in shifts)
    total_cash_out_paise = sum(s.cash_out_paise for s in shifts)
    total_cash_exp_paise = sum(s.cash_expenses_paise for s in shifts)
    total_cash_refunds_paise = sum(s.cash_refunds_paise for s in shifts)
    total_variance_paise = sum(s.variance_paise or 0 for s in shifts if s.status == "closed")

    shift_items = []
    for s in shifts:
        shift_items.append({
            "id": s.id,
            "shift_number": s.shift_number,
            "operator_name": s.operator_name,
            "status": s.status,
            "opened_at": s.opened_at.isoformat() if s.opened_at else None,
            "closed_at": s.closed_at.isoformat() if s.closed_at else None,
            "opening_cash_paise": s.opening_cash_paise,
            "cash_sales_paise": s.cash_sales_paise,
            "cash_in_paise": s.cash_in_paise,
            "cash_out_paise": s.cash_out_paise,
            "cash_expenses_paise": s.cash_expenses_paise,
            "expected_closing_cash_paise": s.expected_closing_cash_paise,
            "actual_closing_cash_paise": s.actual_closing_cash_paise,
            "variance_paise": s.variance_paise,
            "closing_notes": s.closing_notes,
        })

    # Total expenses across all payment methods
    expenses_total_paise = sum(e.amount_paise for e in expenses)
    cash_expenses_total_paise = sum(e.amount_paise for e in expenses if e.payment_method == "cash")
    online_expenses_total_paise = expenses_total_paise - cash_expenses_total_paise

    return {
        "shifts_count": len(shifts),
        "total_opening_paise": total_opening_paise,
        "total_cash_sales_paise": total_cash_sales_paise,
        "total_cash_in_paise": total_cash_in_paise,
        "total_cash_out_paise": total_cash_out_paise,
        "total_cash_expenses_paise": total_cash_exp_paise,
        "total_cash_refunds_paise": total_cash_refunds_paise,
        "total_variance_paise": total_variance_paise,
        "expenses_total_paise": expenses_total_paise,
        "cash_expenses_total_paise": cash_expenses_total_paise,
        "online_expenses_total_paise": online_expenses_total_paise,
        "shifts": shift_items,
    }
