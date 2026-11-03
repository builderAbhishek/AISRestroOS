import io
import csv
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.cash import CashRegisterShift, Expense
from app.schemas.cash import (
    ShiftOpenRequest,
    ShiftCloseRequest,
    CashInRequest,
    CashOutRequest,
    ExpenseCreateRequest,
    CashRegisterShiftResponse,
    CashShiftDetailResponse,
    CashTransactionResponse,
    ExpenseResponse,
    CashDashboardMetricsResponse,
)
from app.business_logic import cash_service
from app.core.exceptions import AISRestroException

router = APIRouter(prefix="/cash", tags=["Cash Management"])


@router.get("/shifts/active", response_model=Optional[CashRegisterShiftResponse])
def get_active_shift_endpoint(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Returns the currently active open cash shift or null if closed."""
    shift = cash_service.get_active_shift(db, restaurant.id)
    return shift


@router.post("/shifts/open", response_model=CashRegisterShiftResponse, status_code=status.HTTP_201_CREATED)
def open_shift_endpoint(
    data: ShiftOpenRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Opens a new cash shift. Rejects if a shift is already open."""
    shift = cash_service.open_shift(
        db=db,
        restaurant_id=restaurant.id,
        opening_cash_paise=data.opening_cash_paise,
        operator_name=data.operator_name,
        opening_notes=data.opening_notes,
    )
    return shift


@router.post("/shifts/{shift_id}/close", response_model=CashRegisterShiftResponse)
def close_shift_endpoint(
    shift_id: str,
    data: ShiftCloseRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Reconciles and closes the active cash shift."""
    shift = cash_service.close_shift(
        db=db,
        shift_id=shift_id,
        restaurant_id=restaurant.id,
        actual_closing_cash_paise=data.actual_closing_cash_paise,
        closing_notes=data.closing_notes,
        closing_operator_name=data.closing_operator_name,
    )
    return shift


@router.post("/shifts/{shift_id}/cash-in", response_model=CashTransactionResponse)
def cash_in_endpoint(
    shift_id: str,
    data: CashInRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Adds cash float/deposit into the drawer."""
    tx = cash_service.record_cash_in(
        db=db,
        shift_id=shift_id,
        restaurant_id=restaurant.id,
        amount_paise=data.amount_paise,
        category=data.category,
        notes=data.notes,
        operator_name=data.operator_name,
    )
    return tx


@router.post("/shifts/{shift_id}/cash-out", response_model=CashTransactionResponse)
def cash_out_endpoint(
    shift_id: str,
    data: CashOutRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Withdraws cash from drawer. Cannot exceed current register cash."""
    tx = cash_service.record_cash_out(
        db=db,
        shift_id=shift_id,
        restaurant_id=restaurant.id,
        amount_paise=data.amount_paise,
        category=data.category,
        notes=data.notes,
        operator_name=data.operator_name,
    )
    return tx


@router.get("/shifts", response_model=List[CashRegisterShiftResponse])
def list_shifts_endpoint(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Lists past and current cash shifts."""
    shifts = cash_service.list_shifts(db, restaurant.id, limit=limit, offset=offset)
    return shifts


@router.get("/shifts/{shift_id}", response_model=CashShiftDetailResponse)
def get_shift_detail_endpoint(
    shift_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Returns shift reconciliation details, transactions, and expenses."""
    shift = (
        db.query(CashRegisterShift)
        .filter(
            CashRegisterShift.id == shift_id,
            CashRegisterShift.restaurant_id == restaurant.id,
        )
        .first()
    )
    if not shift:
        raise AISRestroException("Shift not found.")
    return shift


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense_endpoint(
    data: ExpenseCreateRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Records an operational expense. Cash expenses reduce drawer balance."""
    exp_dt = None
    if data.expense_date:
        try:
            exp_dt = datetime.fromisoformat(data.expense_date.replace("Z", "+00:00"))
        except Exception:
            exp_dt = None

    expense = cash_service.record_expense(
        db=db,
        restaurant_id=restaurant.id,
        category=data.category,
        amount_paise=data.amount_paise,
        payment_method=data.payment_method,
        description=data.description,
        recipient=data.recipient,
        reference_number=data.reference_number,
        notes=data.notes,
        expense_date=exp_dt,
    )
    return expense


@router.get("/expenses", response_model=List[ExpenseResponse])
def list_expenses_endpoint(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Lists operational expenses with filters."""
    s_dt = None
    e_dt = None
    if start_date:
        try:
            s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except Exception:
            pass
    if end_date:
        try:
            e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except Exception:
            pass

    return cash_service.list_expenses(
        db=db,
        restaurant_id=restaurant.id,
        start_date=s_dt,
        end_date=e_dt,
        category=category,
        payment_method=payment_method,
    )


@router.get("/expenses/export/csv")
def export_expenses_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Streams CSV file of expenses for accounting and tax filing."""
    s_dt = None
    e_dt = None
    if start_date:
        try:
            s_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except Exception:
            pass
    if end_date:
        try:
            e_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except Exception:
            pass

    expenses = cash_service.list_expenses(
        db=db,
        restaurant_id=restaurant.id,
        start_date=s_dt,
        end_date=e_dt,
        category=category,
        payment_method=payment_method,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Category", "Amount (INR)", "Payment Method", "Description", "Recipient", "Reference #", "Shift #"])

    for exp in expenses:
        shift_num = exp.shift.shift_number if exp.shift else "N/A"
        date_str = exp.expense_date.strftime("%Y-%m-%d %H:%M") if exp.expense_date else ""
        writer.writerow([
            date_str,
            exp.category,
            f"{exp.amount_paise / 100:.2f}",
            exp.payment_method.upper(),
            exp.description,
            exp.recipient or "-",
            exp.reference_number or "-",
            shift_num,
        ])

    filename = f"{restaurant.name}_expenses_export.csv".replace(" ", "_")
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/metrics", response_model=CashDashboardMetricsResponse)
def get_cash_metrics_endpoint(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Provides real-time drawer metrics for POS and dashboard."""
    active_shift = cash_service.get_active_shift(db, restaurant.id)

    # Today's cash sales and expenses
    now_utc = datetime.now(timezone.utc)
    today_start = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

    today_sales = (
        db.query(func.coalesce(func.sum(Expense.amount_paise), 0))
        .filter(
            Expense.restaurant_id == restaurant.id,
            Expense.payment_method == "cash",
            Expense.expense_date >= today_start,
        )
        .scalar()
    )

    current_drawer = active_shift.current_expected_cash_paise if active_shift else 0

    return CashDashboardMetricsResponse(
        has_active_shift=bool(active_shift),
        active_shift=active_shift,
        today_cash_sales_paise=active_shift.cash_sales_paise if active_shift else 0,
        today_cash_expenses_paise=active_shift.cash_expenses_paise if active_shift else today_sales,
        current_drawer_cash_paise=current_drawer,
    )
