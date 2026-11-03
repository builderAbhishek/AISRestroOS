from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.order import Order, OrderItem
from app.models.billing import Invoice, Payment
from app.schemas.dashboard import (
    DashboardMetricsResponse,
    KPICards,
    SalesTrendPoint,
    DistributionSlice,
    TopSellingItem,
    RecentOrderSummary,
    PaymentSummaryItem,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_date_range(filter_type: str):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

    if filter_type == "yesterday":
        start = today_start - timedelta(days=1)
        end = today_end - timedelta(days=1)
    elif filter_type == "7days":
        start = today_start - timedelta(days=6)
        end = today_end
    elif filter_type == "30days":
        start = today_start - timedelta(days=29)
        end = today_end
    else:  # today
        start = today_start
        end = today_end

    return start, end


@router.get("/metrics", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    date_filter: str = Query("today", pattern="^(today|yesterday|7days|30days)$"),
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_date, end_date = get_date_range(date_filter)

    # Base query for orders within range
    orders_query = db.query(Order).filter(
        Order.restaurant_id == restaurant.id,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
    )

    all_range_orders = orders_query.all()
    completed_orders = [o for o in all_range_orders if o.status == "completed"]
    active_range_orders = [o for o in all_range_orders if o.status == "active"]

    # Global pending amount (all active orders in restaurant currently open)
    all_current_active_orders = (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant.id, Order.status == "active")
        .all()
    )
    pending_amount_paise = sum(o.total_paise for o in all_current_active_orders)

    total_sales_paise = sum(o.total_paise for o in completed_orders)
    total_orders_count = len(all_range_orders)
    completed_count = len(completed_orders)
    aov_paise = (total_sales_paise // completed_count) if completed_count > 0 else 0

    kpis = KPICards(
        total_sales_paise=total_sales_paise,
        total_orders_count=total_orders_count,
        average_order_value_paise=aov_paise,
        pending_amount_paise=pending_amount_paise,
        completed_orders_count=completed_count,
        active_orders_count=len(active_range_orders),
    )

    # 1. Sales Trend
    sales_trend: List[SalesTrendPoint] = []
    if date_filter in ("today", "yesterday"):
        # Hourly breakdown: 08:00 to 23:00
        for h in range(8, 24):
            hour_label = f"{h:02d}:00"
            hour_orders = [
                o for o in completed_orders if o.created_at.hour == h
            ]
            hour_sales = sum(o.total_paise for o in hour_orders)
            sales_trend.append(
                SalesTrendPoint(
                    label=hour_label,
                    sales_paise=hour_sales,
                    orders_count=len(hour_orders),
                )
            )
    else:
        # Daily breakdown
        days_count = 7 if date_filter == "7days" else 30
        for i in range(days_count):
            day_dt = start_date + timedelta(days=i)
            day_label = day_dt.strftime("%d-%b")
            day_orders = [
                o for o in completed_orders
                if o.created_at.date() == day_dt.date()
            ]
            day_sales = sum(o.total_paise for o in day_orders)
            sales_trend.append(
                SalesTrendPoint(
                    label=day_label,
                    sales_paise=day_sales,
                    orders_count=len(day_orders),
                )
            )

    # 2. Order Type Distribution
    type_counts = {"dine_in": 0, "takeaway": 0, "delivery": 0}
    type_amounts = {"dine_in": 0, "takeaway": 0, "delivery": 0}

    for o in all_range_orders:
        otype = o.order_type
        if otype in type_counts:
            type_counts[otype] += 1
            type_amounts[otype] += o.total_paise

    total_type_orders = sum(type_counts.values()) or 1
    type_display_names = {"dine_in": "Dine-in", "takeaway": "Takeaway", "delivery": "Delivery"}

    order_type_distribution = [
        DistributionSlice(
            name=type_display_names[t],
            count=type_counts[t],
            amount_paise=type_amounts[t],
            percentage=round((type_counts[t] / total_type_orders) * 100.0, 1),
        )
        for t in ["dine_in", "takeaway", "delivery"]
    ]

    # 3. Payment Method Distribution & Summary
    payments_in_range = (
        db.query(Payment)
        .join(Order, Payment.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant.id,
            Payment.created_at >= start_date,
            Payment.created_at <= end_date,
        )
        .all()
    )

    pm_map = {"cash": 0, "upi": 0, "card": 0, "other": 0}
    pm_counts = {"cash": 0, "upi": 0, "card": 0, "other": 0}

    for p in payments_in_range:
        m = p.payment_method.lower()
        if m in pm_map:
            pm_map[m] += p.amount_paise
            pm_counts[m] += 1
        else:
            pm_map["other"] += p.amount_paise
            pm_counts["other"] += 1

    total_pm_amount = sum(pm_map.values()) or 1
    pm_names = {"cash": "Cash", "upi": "UPI", "card": "Card", "other": "Other"}

    payment_distribution = [
        DistributionSlice(
            name=pm_names[k],
            count=pm_counts[k],
            amount_paise=pm_map[k],
            percentage=round((pm_map[k] / total_pm_amount) * 100.0, 1),
        )
        for k in ["cash", "upi", "card", "other"]
    ]

    payment_summary = [
        PaymentSummaryItem(
            payment_method=pm_names[k],
            count=pm_counts[k],
            total_paise=pm_map[k],
        )
        for k in ["cash", "upi", "card", "other"]
    ]

    # 4. Top Selling Items
    top_items_rows = (
        db.query(
            OrderItem.menu_item_id,
            OrderItem.item_name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.line_total_paise).label("total_rev"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at >= start_date,
            Order.created_at <= end_date,
        )
        .group_by(OrderItem.menu_item_id, OrderItem.item_name)
        .order_by(desc("total_qty"))
        .limit(5)
        .all()
    )

    top_selling_items = [
        TopSellingItem(
            menu_item_id=r.menu_item_id,
            item_name=r.item_name,
            quantity_sold=int(r.total_qty),
            revenue_paise=int(r.total_rev),
        )
        for r in top_items_rows
    ]

    # 5. Recent Orders (last 6 orders regardless of status)
    recent_orders_rows = (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant.id)
        .order_by(Order.created_at.desc())
        .limit(6)
        .all()
    )

    recent_orders = [
        RecentOrderSummary(
            id=o.id,
            order_code=o.order_code,
            order_type=o.order_type,
            table_number=o.table_number_snapshot,
            status=o.status,
            total_paise=o.total_paise,
            created_at_iso=o.created_at.isoformat(),
            customer_name=o.customer_name,
        )
        for o in recent_orders_rows
    ]

    return DashboardMetricsResponse(
        date_filter=date_filter,
        start_date_iso=start_date.isoformat(),
        end_date_iso=end_date.isoformat(),
        kpis=kpis,
        sales_trend=sales_trend,
        order_type_distribution=order_type_distribution,
        payment_distribution=payment_distribution,
        top_selling_items=top_selling_items,
        recent_orders=recent_orders,
        payment_summary=payment_summary,
    )
