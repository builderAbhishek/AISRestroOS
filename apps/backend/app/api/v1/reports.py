import io
import csv
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.schemas.reports import (
    ExecutiveOverviewResponse,
    SalesTrendPoint,
    ItemWiseSaleItem,
    CategoryWiseSaleItem,
    OrderTypeSaleItem,
    PaymentMethodReportResponse,
    TaxReportResponse,
    InventoryAnalyticsResponse,
    ProfitabilityResponse,
)
from app.business_logic.report_service import (
    resolve_date_range,
    get_executive_overview,
    get_sales_trend,
    get_item_wise_sales,
    get_category_wise_sales,
    get_order_type_sales,
    get_payment_methods_report,
    get_tax_report,
    get_inventory_analytics_report,
    get_profitability_report,
)

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/overview", response_model=ExecutiveOverviewResponse)
def get_reports_overview_endpoint(
    range_type: str = Query("today", description="today, yesterday, this_week, this_month, last_month, custom"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, prev_start, prev_end = resolve_date_range(range_type, start_date, end_date)
    data = get_executive_overview(db, restaurant.id, start_dt, end_dt, prev_start, prev_end)
    return ExecutiveOverviewResponse(**data)


@router.get("/sales-trend", response_model=List[SalesTrendPoint])
def get_sales_trend_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    return get_sales_trend(db, restaurant.id, start_dt, end_dt)


@router.get("/item-sales", response_model=List[ItemWiseSaleItem])
def get_item_sales_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    return get_item_wise_sales(db, restaurant.id, start_dt, end_dt)


@router.get("/category-sales", response_model=List[CategoryWiseSaleItem])
def get_category_sales_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    return get_category_wise_sales(db, restaurant.id, start_dt, end_dt)


@router.get("/order-types", response_model=List[OrderTypeSaleItem])
def get_order_types_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    return get_order_type_sales(db, restaurant.id, start_dt, end_dt)


@router.get("/payment-methods", response_model=PaymentMethodReportResponse)
def get_payment_methods_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    data = get_payment_methods_report(db, restaurant.id, start_dt, end_dt)
    return PaymentMethodReportResponse(**data)


@router.get("/taxes", response_model=TaxReportResponse)
def get_tax_report_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    data = get_tax_report(db, restaurant.id, start_dt, end_dt)
    return TaxReportResponse(**data)


@router.get("/inventory", response_model=InventoryAnalyticsResponse)
def get_inventory_analytics_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    data = get_inventory_analytics_report(db, restaurant.id, start_dt, end_dt)
    return InventoryAnalyticsResponse(**data)


@router.get("/profitability", response_model=ProfitabilityResponse)
def get_profitability_endpoint(
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    data = get_profitability_report(db, restaurant.id, start_dt, end_dt)
    return ProfitabilityResponse(**data)


@router.get("/export-csv")
def export_report_csv(
    report_type: str = Query(..., description="sales, items, categories, taxes, inventory"),
    range_type: str = Query("today"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    start_dt, end_dt, _, _ = resolve_date_range(range_type, start_date, end_date)
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "sales":
        writer.writerow(["Date", "Orders Count", "Gross Sales (INR)", "Discount (INR)", "Net Sales (INR)", "Tax (INR)", "Grand Total (INR)"])
        trend = get_sales_trend(db, restaurant.id, start_dt, end_dt)
        for t in trend:
            writer.writerow([
                t["date"],
                t["orders_count"],
                f"{t['gross_sales_paise'] / 100:.2f}",
                f"{t['discount_paise'] / 100:.2f}",
                f"{t['net_sales_paise'] / 100:.2f}",
                f"{t['tax_paise'] / 100:.2f}",
                f"{t['grand_total_paise'] / 100:.2f}",
            ])

    elif report_type == "items":
        writer.writerow(["Item Name", "Variant", "Quantity Sold", "Total Sales (INR)"])
        items = get_item_wise_sales(db, restaurant.id, start_dt, end_dt)
        for i in items:
            writer.writerow([
                i["item_name"],
                i["variant_name"] or "-",
                i["quantity_sold"],
                f"{i['total_sales_paise'] / 100:.2f}",
            ])

    elif report_type == "categories":
        writer.writerow(["Category Name", "Quantity Sold", "Total Sales (INR)", "Percentage Share (%)"])
        cats = get_category_wise_sales(db, restaurant.id, start_dt, end_dt)
        for c in cats:
            writer.writerow([
                c["category_name"],
                c["quantity_sold"],
                f"{c['total_sales_paise'] / 100:.2f}",
                f"{c['percentage']}%",
            ])

    elif report_type == "taxes":
        writer.writerow(["Invoice Number", "Date", "Taxable (INR)", "CGST (INR)", "SGST (INR)", "IGST (INR)", "Total Tax (INR)", "Grand Total (INR)", "Status"])
        tax_data = get_tax_report(db, restaurant.id, start_dt, end_dt)
        for inv in tax_data["invoices"]:
            writer.writerow([
                inv["invoice_number"],
                inv["created_at"],
                f"{inv['taxable_amount_paise'] / 100:.2f}",
                f"{inv['cgst_paise'] / 100:.2f}",
                f"{inv['sgst_paise'] / 100:.2f}",
                f"{inv['igst_paise'] / 100:.2f}",
                f"{inv['total_tax_paise'] / 100:.2f}",
                f"{inv['grand_total_paise'] / 100:.2f}",
                inv["status"],
            ])

    elif report_type == "inventory":
        writer.writerow(["Item Name", "SKU", "Unit", "Current Stock", "Reorder Level", "Unit Cost (INR)", "Stock Value (INR)"])
        from app.models.inventory import InventoryItem
        inv_items = db.query(InventoryItem).filter(InventoryItem.restaurant_id == restaurant.id).all()
        for it in inv_items:
            val = int(round(it.current_stock * it.cost_per_unit_paise))
            writer.writerow([
                it.name,
                it.sku or "-",
                it.unit,
                it.current_stock,
                it.reorder_level,
                f"{it.cost_per_unit_paise / 100:.2f}",
                f"{val / 100:.2f}",
            ])

    filename = f"{restaurant.name}_{report_type}_report_{range_type}.csv".replace(" ", "_")
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
