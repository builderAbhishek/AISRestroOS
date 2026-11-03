from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.inventory import (
    InventoryCategory,
    Supplier,
    InventoryItem,
    Purchase,
    PurchaseItem,
    SupplierPayment,
    StockMovement,
    Recipe,
    RecipeIngredient,
    WastageRecord,
)
from app.models.menu import MenuItem, MenuVariant
from app.schemas.inventory import (
    InventoryCategoryCreate,
    InventoryCategoryUpdate,
    InventoryCategoryResponse,
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    PurchaseCreate,
    PurchaseResponse,
    PurchaseItemResponse,
    SupplierPaymentInput,
    SupplierPaymentResponse,
    RecipeCreateOrUpdate,
    RecipeResponse,
    RecipeIngredientResponse,
    WastageCreate,
    WastageResponse,
    StockAdjustmentCreate,
    StockMovementResponse,
    InventoryDashboardResponse,
)
from app.business_logic.inventory_service import (
    receive_purchase,
    cancel_purchase_with_stock_reversal,
    record_wastage,
    record_stock_adjustment,
)
from app.core.exceptions import EntityNotFoundException, AISRestroException
from app.core.logging import logger

router = APIRouter(prefix="/inventory", tags=["Inventory Management"])


def _item_to_response(item: InventoryItem) -> InventoryItemResponse:
    val = int(round(item.current_stock * item.cost_per_unit_paise))
    return InventoryItemResponse(
        id=item.id,
        restaurant_id=item.restaurant_id,
        name=item.name,
        sku=item.sku,
        category_id=item.category_id,
        category_name=item.category.name if item.category else None,
        supplier_id=item.supplier_id,
        supplier_name=item.supplier.name if item.supplier else None,
        unit=item.unit,
        current_stock=item.current_stock,
        minimum_stock=item.minimum_stock,
        reorder_level=item.reorder_level,
        cost_per_unit_paise=item.cost_per_unit_paise,
        stock_value_paise=val,
        is_active=item.is_active,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _purchase_to_response(p: Purchase) -> PurchaseResponse:
    items = [
        PurchaseItemResponse(
            id=pi.id,
            inventory_item_id=pi.inventory_item_id,
            item_name=pi.inventory_item.name if pi.inventory_item else None,
            quantity=pi.quantity,
            unit=pi.unit,
            unit_cost_paise=pi.unit_cost_paise,
            total_cost_paise=pi.total_cost_paise,
        )
        for pi in p.items
    ]
    payments = [
        SupplierPaymentResponse(
            id=sp.id,
            amount_paise=sp.amount_paise,
            payment_method=sp.payment_method,
            reference_number=sp.reference_number,
            notes=sp.notes,
            created_at=sp.created_at,
        )
        for sp in p.payments
    ]
    return PurchaseResponse(
        id=p.id,
        restaurant_id=p.restaurant_id,
        purchase_number=p.purchase_number,
        supplier_id=p.supplier_id,
        supplier_name=p.supplier.name if p.supplier else None,
        invoice_number=p.invoice_number,
        purchase_date=p.purchase_date,
        status=p.status,
        subtotal_paise=p.subtotal_paise,
        tax_paise=p.tax_paise,
        total_cost_paise=p.total_cost_paise,
        paid_amount_paise=p.paid_amount_paise,
        due_amount_paise=p.due_amount_paise,
        notes=p.notes,
        items=items,
        payments=payments,
        created_at=p.created_at,
    )


def _recipe_to_response(r: Recipe) -> RecipeResponse:
    ingredients = [
        RecipeIngredientResponse(
            id=ri.id,
            inventory_item_id=ri.inventory_item_id,
            inventory_item_name=ri.inventory_item.name if ri.inventory_item else None,
            quantity=ri.quantity,
            unit=ri.unit,
            cost_per_unit_paise=ri.inventory_item.cost_per_unit_paise if ri.inventory_item else 0,
            total_cost_paise=int(round(ri.quantity * (ri.inventory_item.cost_per_unit_paise if ri.inventory_item else 0))),
        )
        for ri in r.ingredients
    ]
    total_cost = sum(i.total_cost_paise for i in ingredients)
    return RecipeResponse(
        id=r.id,
        restaurant_id=r.restaurant_id,
        menu_item_id=r.menu_item_id,
        menu_item_name=r.menu_item.name if r.menu_item else None,
        variant_id=r.variant_id,
        variant_name=r.variant.name if r.variant else None,
        notes=r.notes,
        ingredients=ingredients,
        total_cost_paise=total_cost,
        created_at=r.created_at,
    )


# --- Dashboard ---
@router.get("/dashboard", response_model=InventoryDashboardResponse)
def get_inventory_dashboard(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    items = db.query(InventoryItem).filter(InventoryItem.restaurant_id == restaurant.id, InventoryItem.is_active == True).all()
    total_items = len(items)
    total_stock_val = sum(int(round(i.current_stock * i.cost_per_unit_paise)) for i in items)
    low_stock = [i for i in items if i.current_stock <= i.reorder_level and i.current_stock > 0]
    out_of_stock = [i for i in items if i.current_stock <= 0]

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Today's purchases
    today_purchases = (
        db.query(func.coalesce(func.sum(StockMovement.total_cost_paise), 0))
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(
            InventoryItem.restaurant_id == restaurant.id,
            StockMovement.movement_type == "PURCHASE_IN",
            StockMovement.created_at >= today_start,
        )
        .scalar()
    )

    # Today's consumption
    today_consumption = (
        db.query(func.coalesce(func.sum(StockMovement.total_cost_paise), 0))
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(
            InventoryItem.restaurant_id == restaurant.id,
            StockMovement.movement_type == "SALE_CONSUMPTION",
            StockMovement.created_at >= today_start,
        )
        .scalar()
    )

    # Today's wastage
    today_wastage = (
        db.query(func.coalesce(func.sum(WastageRecord.cost_paise), 0))
        .filter(
            WastageRecord.restaurant_id == restaurant.id,
            WastageRecord.created_at >= today_start,
        )
        .scalar()
    )

    # Recent movements
    recent_m = (
        db.query(StockMovement)
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(InventoryItem.restaurant_id == restaurant.id)
        .order_by(StockMovement.created_at.desc())
        .limit(10)
        .all()
    )
    movement_responses = [
        StockMovementResponse(
            id=m.id,
            inventory_item_id=m.inventory_item_id,
            item_name=m.inventory_item.name if m.inventory_item else None,
            movement_type=m.movement_type,
            quantity_change=m.quantity_change,
            quantity_after=m.quantity_after,
            unit=m.inventory_item.unit if m.inventory_item else None,
            unit_cost_paise=m.unit_cost_paise,
            total_cost_paise=m.total_cost_paise,
            reference_type=m.reference_type,
            reference_id=m.reference_id,
            reason=m.reason,
            created_at=m.created_at,
        )
        for m in recent_m
    ]

    # Top consumed ingredients
    consumed = (
        db.query(
            InventoryItem.name,
            InventoryItem.unit,
            func.sum(func.abs(StockMovement.quantity)).label("qty"),
            func.sum(StockMovement.total_cost_paise).label("cost"),
        )
        .join(StockMovement, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(
            InventoryItem.restaurant_id == restaurant.id,
            StockMovement.movement_type == "SALE_CONSUMPTION",
        )
        .group_by(InventoryItem.id)
        .order_by(func.sum(StockMovement.total_cost_paise).desc())
        .limit(5)
        .all()
    )
    top_consumed = [
        {"name": c[0], "unit": c[1], "quantity": float(c[2]), "cost_paise": int(c[3])}
        for c in consumed
    ]

    return InventoryDashboardResponse(
        total_items=total_items,
        total_stock_value_paise=total_stock_val,
        low_stock_count=len(low_stock),
        out_of_stock_count=len(out_of_stock),
        today_purchases_paise=today_purchases,
        today_consumption_paise=today_consumption,
        today_wastage_paise=today_wastage,
        low_stock_items=[_item_to_response(i) for i in low_stock + out_of_stock][:10],
        recent_movements=movement_responses,
        top_consumed_ingredients=top_consumed,
    )


# --- Categories ---
@router.get("/categories", response_model=List[InventoryCategoryResponse])
def list_categories(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    return db.query(InventoryCategory).filter(InventoryCategory.restaurant_id == restaurant.id).order_by(InventoryCategory.name).all()


@router.post("/categories", response_model=InventoryCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: InventoryCategoryCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    cat = InventoryCategory(
        restaurant_id=restaurant.id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=InventoryCategoryResponse)
def update_category(
    category_id: str,
    data: InventoryCategoryUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    cat = db.query(InventoryCategory).filter(InventoryCategory.id == category_id, InventoryCategory.restaurant_id == restaurant.id).first()
    if not cat:
        raise EntityNotFoundException("InventoryCategory", category_id)
    if data.name is not None:
        cat.name = data.name.strip()
    if data.description is not None:
        cat.description = data.description.strip()
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    cat = db.query(InventoryCategory).filter(InventoryCategory.id == category_id, InventoryCategory.restaurant_id == restaurant.id).first()
    if not cat:
        raise EntityNotFoundException("InventoryCategory", category_id)
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted successfully"}


# --- Suppliers ---
@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    return db.query(Supplier).filter(Supplier.restaurant_id == restaurant.id).order_by(Supplier.name).all()


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    sup = Supplier(
        restaurant_id=restaurant.id,
        name=data.name.strip(),
        contact_person=data.contact_person,
        phone=data.phone or "",
        email=data.email,
        address=data.address,
        gstin=data.gst_number or getattr(data, 'gstin', None),
    )
    db.add(sup)
    db.commit()
    db.refresh(sup)
    return sup


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    sup = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.restaurant_id == restaurant.id).first()
    if not sup:
        raise EntityNotFoundException("Supplier", supplier_id)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(sup, field, val)
    db.commit()
    db.refresh(sup)
    return sup


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    sup = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.restaurant_id == restaurant.id).first()
    if not sup:
        raise EntityNotFoundException("Supplier", supplier_id)
    db.delete(sup)
    db.commit()
    return {"message": "Supplier deleted successfully"}


# --- Items ---
@router.get("/items", response_model=List[InventoryItemResponse])
def list_inventory_items(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    low_stock_only: bool = False,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryItem).filter(InventoryItem.restaurant_id == restaurant.id)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(or_(InventoryItem.name.ilike(term), InventoryItem.sku.ilike(term)))
    if category_id:
        query = query.filter(InventoryItem.category_id == category_id)
    if supplier_id:
        query = query.filter(InventoryItem.supplier_id == supplier_id)
    if low_stock_only:
        query = query.filter(InventoryItem.current_stock <= InventoryItem.reorder_level)

    items = query.order_by(InventoryItem.name).all()
    return [_item_to_response(i) for i in items]


@router.post("/items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(
    data: InventoryItemCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    cat_id = data.category_id
    if not cat_id:
        default_cat = (
            db.query(InventoryCategory)
            .filter(InventoryCategory.restaurant_id == restaurant.id, InventoryCategory.name == "General")
            .first()
        )
        if not default_cat:
            default_cat = InventoryCategory(
                restaurant_id=restaurant.id,
                name="General",
                description="Default general inventory category",
            )
            db.add(default_cat)
            db.flush()
        cat_id = default_cat.id

    item = InventoryItem(
        restaurant_id=restaurant.id,
        name=data.name.strip(),
        sku=data.sku.strip() if data.sku else None,
        category_id=cat_id,
        supplier_id=data.supplier_id,
        unit=data.unit,
        current_stock=data.current_stock,
        min_stock_level=data.minimum_stock,
        reorder_level=data.reorder_level,
        cost_price_paise=data.cost_per_unit_paise,
        is_active=data.is_active,
        notes=data.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # If initial stock provided > 0, record adjustment
    if data.current_stock > 0:
        mov = StockMovement(
            restaurant_id=restaurant.id,
            inventory_item_id=item.id,
            movement_type="MANUAL_ADJUSTMENT_IN",
            quantity=data.current_stock,
            unit=item.unit,
            previous_stock=0.0,
            new_stock=data.current_stock,
            unit_cost_paise=data.cost_per_unit_paise,
            total_cost_paise=int(round(data.current_stock * data.cost_per_unit_paise)),
            reason="Opening Stock",
        )
        db.add(mov)
        db.commit()

    return _item_to_response(item)


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.restaurant_id == restaurant.id).first()
    if not item:
        raise EntityNotFoundException("InventoryItem", item_id)
    return _item_to_response(item)


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    item_id: str,
    data: InventoryItemUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.restaurant_id == restaurant.id).first()
    if not item:
        raise EntityNotFoundException("InventoryItem", item_id)
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(item, field, val)
    db.commit()
    db.refresh(item)
    return _item_to_response(item)


@router.delete("/items/{item_id}")
def delete_inventory_item(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id, InventoryItem.restaurant_id == restaurant.id).first()
    if not item:
        raise EntityNotFoundException("InventoryItem", item_id)
    item.is_active = False
    db.commit()
    return {"message": "Inventory item deactivated"}


# --- Purchases ---
@router.get("/purchases", response_model=List[PurchaseResponse])
def list_purchases(
    status_filter: Optional[str] = None,
    supplier_id: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(Purchase).filter(Purchase.restaurant_id == restaurant.id)
    if status_filter and status_filter != "all":
        query = query.filter(Purchase.status == status_filter)
    if supplier_id:
        query = query.filter(Purchase.supplier_id == supplier_id)

    purchases = query.order_by(Purchase.created_at.desc()).all()
    return [_purchase_to_response(p) for p in purchases]


@router.post("/purchases", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    data: PurchaseCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    max_num = db.query(func.coalesce(func.max(Purchase.purchase_number), 0)).filter(Purchase.restaurant_id == restaurant.id).scalar()
    purchase_number = max_num + 1

    purchase_date = datetime.now(timezone.utc)
    if data.purchase_date:
        try:
            purchase_date = datetime.fromisoformat(data.purchase_date.replace("Z", "+00:00"))
        except Exception:
            pass

    supplier_id = data.supplier_id
    if not supplier_id:
        def_sup = db.query(Supplier).filter(Supplier.restaurant_id == restaurant.id, Supplier.name == "Direct Store / Cash").first()
        if not def_sup:
            def_sup = Supplier(
                restaurant_id=restaurant.id,
                name="Direct Store / Cash",
                phone="",
            )
            db.add(def_sup)
            db.flush()
        supplier_id = def_sup.id

    total_cost = sum(int(round(i.quantity * i.unit_cost_paise)) for i in data.items)

    purchase = Purchase(
        restaurant_id=restaurant.id,
        purchase_number=f"PO-{purchase_number:04d}",
        supplier_id=supplier_id,
        invoice_number=data.invoice_number,
        purchase_date=purchase_date,
        status="draft",
        subtotal_paise=total_cost,
        tax_paise=0,
        total_paise=total_cost,
        paid_amount_paise=0,
        due_amount_paise=total_cost,
        notes=data.notes,
    )
    db.add(purchase)
    db.flush()

    for item_in in data.items:
        line_cost = int(round(item_in.quantity * item_in.unit_cost_paise))
        pi = PurchaseItem(
            purchase_id=purchase.id,
            inventory_item_id=item_in.inventory_item_id,
            quantity=item_in.quantity,
            unit=item_in.unit,
            unit_cost_paise=item_in.unit_cost_paise,
            line_total_paise=line_cost,
            tax_rate_percent=0.0,
            tax_paise=0,
        )
        db.add(pi)

    db.commit()
    db.refresh(purchase)

    # Initial payment if provided
    if data.initial_payment:
        pay = SupplierPayment(
            purchase_id=purchase.id,
            amount_paise=data.initial_payment.amount_paise,
            payment_method=data.initial_payment.payment_method,
            payment_date=datetime.now(timezone.utc),
            reference_number=data.initial_payment.reference_number,
            notes=data.initial_payment.notes,
        )
        db.add(pay)
        purchase.paid_amount_paise += data.initial_payment.amount_paise
        purchase.due_amount_paise = max(0, purchase.total_cost_paise - purchase.paid_amount_paise)
        db.commit()
        db.refresh(purchase)

    # Auto receive if requested
    if data.auto_receive:
        receive_purchase(db, purchase)
        db.refresh(purchase)

    return _purchase_to_response(purchase)


@router.get("/purchases/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    purchase_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    p = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.restaurant_id == restaurant.id).first()
    if not p:
        raise EntityNotFoundException("Purchase", purchase_id)
    return _purchase_to_response(p)


@router.post("/purchases/{purchase_id}/receive", response_model=PurchaseResponse)
def receive_purchase_endpoint(
    purchase_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    p = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.restaurant_id == restaurant.id).first()
    if not p:
        raise EntityNotFoundException("Purchase", purchase_id)
    receive_purchase(db, p)
    db.refresh(p)
    return _purchase_to_response(p)


@router.post("/purchases/{purchase_id}/cancel", response_model=PurchaseResponse)
def cancel_purchase_endpoint(
    purchase_id: str,
    reason: str = Query(..., min_length=1),
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    p = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.restaurant_id == restaurant.id).first()
    if not p:
        raise EntityNotFoundException("Purchase", purchase_id)
    cancel_purchase_with_stock_reversal(db, p, reason=reason)
    db.refresh(p)
    return _purchase_to_response(p)


@router.post("/purchases/{purchase_id}/payments", response_model=PurchaseResponse)
def record_supplier_payment(
    purchase_id: str,
    data: SupplierPaymentInput,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    p = db.query(Purchase).filter(Purchase.id == purchase_id, Purchase.restaurant_id == restaurant.id).first()
    if not p:
        raise EntityNotFoundException("Purchase", purchase_id)
    if data.amount_paise > p.due_amount_paise:
        raise AISRestroException(f"Payment amount exceeds purchase due amount of INR {p.due_amount_paise / 100:.2f}")

    pay = SupplierPayment(
        purchase_id=p.id,
        amount_paise=data.amount_paise,
        payment_method=data.payment_method,
        payment_date=datetime.now(timezone.utc),
        reference_number=data.reference_number,
        notes=data.notes,
    )
    db.add(pay)
    p.paid_amount_paise += data.amount_paise
    p.due_amount_paise = max(0, p.total_cost_paise - p.paid_amount_paise)
    db.commit()
    db.refresh(p)
    return _purchase_to_response(p)


# --- Recipes ---
@router.get("/recipes", response_model=List[RecipeResponse])
def list_recipes(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    recipes = db.query(Recipe).filter(Recipe.restaurant_id == restaurant.id).all()
    return [_recipe_to_response(r) for r in recipes]


@router.get("/recipes/item/{menu_item_id}", response_model=List[RecipeResponse])
def get_item_recipes(
    menu_item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    recipes = db.query(Recipe).filter(Recipe.restaurant_id == restaurant.id, Recipe.menu_item_id == menu_item_id).all()
    return [_recipe_to_response(r) for r in recipes]


@router.post("/recipes", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_recipe(
    data: RecipeCreateOrUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(Recipe)
        .filter(
            Recipe.restaurant_id == restaurant.id,
            Recipe.menu_item_id == data.menu_item_id,
            Recipe.variant_id == data.variant_id,
        )
        .first()
    )
    if existing:
        # Delete existing ingredients and update
        db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == existing.id).delete()
        existing.notes = data.notes
        recipe = existing
    else:
        recipe = Recipe(
            restaurant_id=restaurant.id,
            menu_item_id=data.menu_item_id,
            variant_id=data.variant_id,
            notes=data.notes,
        )
        db.add(recipe)
        db.flush()

    for ing in data.ingredients:
        ri = RecipeIngredient(
            recipe_id=recipe.id,
            inventory_item_id=ing.inventory_item_id,
            quantity=ing.quantity,
            unit=ing.unit,
        )
        db.add(ri)

    db.commit()
    db.refresh(recipe)
    return _recipe_to_response(recipe)


@router.delete("/recipes/{recipe_id}")
def delete_recipe(
    recipe_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.restaurant_id == restaurant.id).first()
    if not recipe:
        raise EntityNotFoundException("Recipe", recipe_id)
    db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).delete()
    db.delete(recipe)
    db.commit()
    return {"message": "Recipe deleted successfully"}


# --- Wastage & Adjustments ---
@router.post("/wastage", response_model=WastageResponse, status_code=status.HTTP_201_CREATED)
def record_wastage_endpoint(
    data: WastageCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == data.inventory_item_id, InventoryItem.restaurant_id == restaurant.id).first()
    if not item:
        raise EntityNotFoundException("InventoryItem", data.inventory_item_id)

    wastage = record_wastage(
        db=db,
        restaurant_id=restaurant.id,
        inventory_item_id=item.id,
        quantity=data.quantity,
        unit=data.unit or item.unit,
        reason=data.reason,
        notes=data.notes,
    )
    return WastageResponse(
        id=wastage.id,
        inventory_item_id=wastage.inventory_item_id,
        item_name=item.name,
        quantity=wastage.quantity,
        unit=item.unit,
        cost_paise=wastage.cost_paise,
        reason=wastage.reason,
        notes=wastage.notes,
        created_at=wastage.created_at,
    )


@router.get("/wastage", response_model=List[WastageResponse])
def list_wastage(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    records = db.query(WastageRecord).filter(WastageRecord.restaurant_id == restaurant.id).order_by(WastageRecord.created_at.desc()).limit(100).all()
    return [
        WastageResponse(
            id=w.id,
            inventory_item_id=w.inventory_item_id,
            item_name=w.inventory_item.name if w.inventory_item else None,
            quantity=w.quantity,
            unit=w.inventory_item.unit if w.inventory_item else None,
            cost_paise=w.cost_paise,
            reason=w.reason,
            notes=w.notes,
            created_at=w.created_at,
        )
        for w in records
    ]


@router.post("/adjustments", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def record_adjustment_endpoint(
    data: StockAdjustmentCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == data.inventory_item_id, InventoryItem.restaurant_id == restaurant.id).first()
    if not item:
        raise EntityNotFoundException("InventoryItem", data.inventory_item_id)

    mov = record_stock_adjustment(
        db=db,
        inventory_item_id=item.id,
        adjustment_type=data.adjustment_type,
        quantity=data.quantity,
        reason=data.reason,
        restaurant_id=restaurant.id,
        notes=data.notes,
    )
    return StockMovementResponse(
        id=mov.id,
        inventory_item_id=mov.inventory_item_id,
        item_name=item.name,
        movement_type=mov.movement_type,
        quantity_change=mov.quantity_change,
        quantity_after=mov.quantity_after,
        unit=item.unit,
        unit_cost_paise=mov.unit_cost_paise,
        total_cost_paise=mov.total_cost_paise,
        reference_type=mov.reference_type,
        reference_id=mov.reference_id,
        reason=mov.reason,
        created_at=mov.created_at,
    )


@router.get("/movements", response_model=List[StockMovementResponse])
def list_stock_movements(
    inventory_item_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = (
        db.query(StockMovement)
        .join(InventoryItem, StockMovement.inventory_item_id == InventoryItem.id)
        .filter(InventoryItem.restaurant_id == restaurant.id)
    )
    if inventory_item_id:
        query = query.filter(StockMovement.inventory_item_id == inventory_item_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)

    movements = query.order_by(StockMovement.created_at.desc()).limit(200).all()
    return [
        StockMovementResponse(
            id=m.id,
            inventory_item_id=m.inventory_item_id,
            item_name=m.inventory_item.name if m.inventory_item else None,
            movement_type=m.movement_type,
            quantity_change=m.quantity_change,
            quantity_after=m.quantity_after,
            unit=m.inventory_item.unit if m.inventory_item else None,
            unit_cost_paise=m.unit_cost_paise,
            total_cost_paise=m.total_cost_paise,
            reference_type=m.reference_type,
            reference_id=m.reference_id,
            reason=m.reason,
            created_at=m.created_at,
        )
        for m in movements
    ]
