import os
import time
import shutil
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api.deps import get_db, get_current_restaurant, require_restaurant
from app.models.restaurant import Restaurant, RestaurantSettings
from app.models.tax import TaxConfiguration
from app.models.menu import MenuCategory, MenuItem, MenuVariant, AddonGroup, Addon
from app.models.table import RestaurantTable
from app.schemas.restaurant import (
    RestaurantSetupRequest,
    RestaurantResponse,
    RestaurantSettingsBase,
    RestaurantSettingsResponse,
    RestaurantUpdateRequest,
)
from app.core.exceptions import AISRestroException
from app.core.logging import logger

router = APIRouter(prefix="/restaurant", tags=["Restaurant & Settings"])


def seed_sample_menu_and_tables(db: Session, restaurant: Restaurant):
    """Pre-populates popular restaurant categories, items, variants, addons, and tables."""
    # Check if already seeded
    existing_cat = db.query(MenuCategory).filter(MenuCategory.restaurant_id == restaurant.id).first()
    if existing_cat:
        return

    # 1. Categories
    cat_starters = MenuCategory(
        restaurant_id=restaurant.id, name="Starters & Snacks", description="Crispy & flavorful appetizers", sort_order=1
    )
    cat_main = MenuCategory(
        restaurant_id=restaurant.id, name="Main Course", description="Authentic curries & gravies", sort_order=2
    )
    cat_biryani = MenuCategory(
        restaurant_id=restaurant.id, name="Biryani & Rice", description="Aromatic dum cooked rice dishes", sort_order=3
    )
    cat_breads = MenuCategory(
        restaurant_id=restaurant.id, name="Breads & Rotis", description="Fresh from the tandoor", sort_order=4
    )
    cat_beverages = MenuCategory(
        restaurant_id=restaurant.id, name="Beverages & Desserts", description="Refreshing drinks and sweets", sort_order=5
    )
    db.add_all([cat_starters, cat_main, cat_biryani, cat_breads, cat_beverages])
    db.flush()

    # 2. Addon Groups & Addons
    addon_spice = AddonGroup(
        restaurant_id=restaurant.id, name="Spice Level", min_selection=0, max_selection=1, is_required=False
    )
    addon_extra = AddonGroup(
        restaurant_id=restaurant.id, name="Extras", min_selection=0, max_selection=3, is_required=False
    )
    db.add_all([addon_spice, addon_extra])
    db.flush()

    db.add_all([
        Addon(addon_group_id=addon_spice.id, name="Mild", price_paise=0),
        Addon(addon_group_id=addon_spice.id, name="Medium Spicy", price_paise=0),
        Addon(addon_group_id=addon_spice.id, name="Extra Hot", price_paise=0),
        Addon(addon_group_id=addon_extra.id, name="Extra Butter", price_paise=2500),      # ₹25.00
        Addon(addon_group_id=addon_extra.id, name="Extra Cheese", price_paise=4000),      # ₹40.00
        Addon(addon_group_id=addon_extra.id, name="Mint Chutney Dip", price_paise=1500), # ₹15.00
    ])
    db.flush()

    # 3. Menu Items
    # Paneer Tikka (with variants: Half / Full)
    paneer_tikka = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_starters.id,
        name="Paneer Tikka",
        item_code="ST-01",
        description="Char-grilled cottage cheese marinated in spiced yogurt and aromatics",
        base_price_paise=22000,  # ₹220.00
        is_veg=True,
        is_available=True,
        has_variants=True,
        sort_order=1,
    )
    paneer_tikka.addon_groups.extend([addon_spice, addon_extra])
    db.add(paneer_tikka)
    db.flush()

    db.add_all([
        MenuVariant(item_id=paneer_tikka.id, name="Half (4 pcs)", price_paise=14000, is_default=False),
        MenuVariant(item_id=paneer_tikka.id, name="Full (8 pcs)", price_paise=24000, is_default=True),
    ])

    # Crispy Corn
    crispy_corn = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_starters.id,
        name="Crispy Corn Salt & Pepper",
        item_code="ST-02",
        description="Golden fried corn kernels tossed with peppers, herbs and chaat masala",
        base_price_paise=18000,  # ₹180.00
        is_veg=True,
        is_available=True,
        has_variants=False,
        sort_order=2,
    )
    crispy_corn.addon_groups.append(addon_spice)
    db.add(crispy_corn)

    # Chicken Malai Tikka
    chicken_tikka = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_starters.id,
        name="Chicken Malai Tikka",
        item_code="ST-03",
        description="Succulent chicken chunks marinated in cream, cashew paste, and mild spices",
        base_price_paise=28000,  # ₹280.00
        is_veg=False,
        is_available=True,
        has_variants=False,
        sort_order=3,
    )
    chicken_tikka.addon_groups.append(addon_extra)
    db.add(chicken_tikka)

    # Butter Chicken
    butter_chicken = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_main.id,
        name="Butter Chicken Boneless",
        item_code="MC-01",
        description="Tandoori chicken simmered in rich satin-smooth tomato makhani gravy",
        base_price_paise=32000,  # ₹320.00
        is_veg=False,
        is_available=True,
        has_variants=True,
        sort_order=1,
    )
    butter_chicken.addon_groups.append(addon_extra)
    db.add(butter_chicken)
    db.flush()

    db.add_all([
        MenuVariant(item_id=butter_chicken.id, name="Regular", price_paise=32000, is_default=True),
        MenuVariant(item_id=butter_chicken.id, name="Large", price_paise=52000, is_default=False),
    ])

    # Dal Makhani
    dal_makhani = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_main.id,
        name="Dal Makhani Special",
        item_code="MC-02",
        description="Slow-simmered black lentils cooked overnight with butter and cream",
        base_price_paise=22000,  # ₹220.00
        is_veg=True,
        is_available=True,
        has_variants=False,
        sort_order=2,
    )
    dal_makhani.addon_groups.append(addon_extra)
    db.add(dal_makhani)

    # Paneer Butter Masala
    paneer_butter = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_main.id,
        name="Paneer Butter Masala",
        item_code="MC-03",
        description="Soft cottage cheese cubes in rich aromatic cashew and onion-tomato gravy",
        base_price_paise=24000,  # ₹240.00
        is_veg=True,
        is_available=True,
        has_variants=False,
        sort_order=3,
    )
    db.add(paneer_butter)

    # Veg Dum Biryani
    veg_biryani = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_biryani.id,
        name="Hyderabadi Veg Dum Biryani",
        item_code="BR-01",
        description="Fragrant basmati rice layered with mixed vegetables, saffron, and fresh mint",
        base_price_paise=22000,  # ₹220.00
        is_veg=True,
        is_available=True,
        has_variants=False,
        sort_order=1,
    )
    db.add(veg_biryani)

    # Chicken Dum Biryani
    chicken_biryani = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_biryani.id,
        name="Awadhi Chicken Dum Biryani",
        item_code="BR-02",
        description="Slow cooked aromatic basmati rice infused with tender chicken and kewra water",
        base_price_paise=29000,  # ₹290.00
        is_veg=False,
        is_available=True,
        has_variants=False,
        sort_order=2,
    )
    db.add(chicken_biryani)

    # Butter Naan & Garlic Naan
    butter_naan = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_breads.id,
        name="Butter Naan",
        item_code="BD-01",
        description="Fluffy tandoori leavened bread brushed with pure butter",
        base_price_paise=4500,  # ₹45.00
        is_veg=True,
        is_available=True,
        sort_order=1,
    )
    garlic_naan = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_breads.id,
        name="Garlic Naan",
        item_code="BD-02",
        description="Tandoori naan topped with roasted minced garlic and coriander",
        base_price_paise=6000,  # ₹60.00
        is_veg=True,
        is_available=True,
        sort_order=2,
    )
    db.add_all([butter_naan, garlic_naan])

    # Beverages
    masala_chaas = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_beverages.id,
        name="Spiced Buttermilk (Chaas)",
        item_code="BV-01",
        description="Cooling yogurt drink seasoned with roasted cumin and fresh coriander",
        base_price_paise=5000,  # ₹50.00
        is_veg=True,
        is_available=True,
        sort_order=1,
    )
    gulab_jamun = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat_beverages.id,
        name="Gulab Jamun (2 pcs)",
        item_code="DS-01",
        description="Warm fried milk dough balls soaked in cardamom saffron sugar syrup",
        base_price_paise=7000,  # ₹70.00
        is_veg=True,
        is_available=True,
        sort_order=2,
    )
    db.add_all([masala_chaas, gulab_jamun])

    # 4. Tables (8 tables across 2 sections)
    tables = [
        RestaurantTable(restaurant_id=restaurant.id, table_number="T1", capacity=2, section="Ground Floor", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T2", capacity=4, section="Ground Floor", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T3", capacity=4, section="Ground Floor", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T4", capacity=6, section="Ground Floor", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T5", capacity=4, section="Family Section", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T6", capacity=6, section="Family Section", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T7", capacity=8, section="Family Section", status="available"),
        RestaurantTable(restaurant_id=restaurant.id, table_number="T8", capacity=4, section="Outdoor Garden", status="available"),
    ]
    db.add_all(tables)

    db.commit()
    logger.info("Sample menu and tables seeded successfully.")


@router.get("/current", response_model=RestaurantResponse)
def get_restaurant_info(restaurant: Restaurant = Depends(require_restaurant)):
    return restaurant


@router.post("/setup", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
def setup_restaurant(data: RestaurantSetupRequest, db: Session = Depends(get_db)):
    existing = db.query(Restaurant).first()
    if existing:
        raise AISRestroException("Restaurant is already configured. Use PUT /profile to update.")

    restaurant = Restaurant(
        name=data.name,
        legal_name=data.legal_name or data.name,
        owner_name=data.owner_name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        logo_url=data.logo_url,
        currency=data.currency,
        currency_symbol=data.currency_symbol,
        language=data.language,
        gst_registered=data.gst_registered,
        gstin=data.gstin,
    )
    db.add(restaurant)
    db.flush()

    settings = RestaurantSettings(
        restaurant_id=restaurant.id,
        is_tax_enabled=data.is_tax_enabled,
        is_tax_inclusive=data.is_tax_inclusive,
        tax_rate_percent=data.tax_rate_percent,
        tax_type=data.tax_type,
        paper_width_mm=data.paper_width_mm,
        bill_footer_text=data.bill_footer_text or "Thank you for dining with us! Please visit again.",
    )
    db.add(settings)

    # Initial GST tax config
    tax_config = TaxConfiguration(
        restaurant_id=restaurant.id,
        name="GST",
        rate_percent=data.tax_rate_percent,
        cgst_percent=data.tax_rate_percent / 2.0,
        sgst_percent=data.tax_rate_percent / 2.0,
        is_active=True,
    )
    db.add(tax_config)
    db.commit()
    db.refresh(restaurant)

    if data.seed_sample_menu:
        seed_sample_menu_and_tables(db, restaurant)
        db.refresh(restaurant)

    logger.info(f"Restaurant '{restaurant.name}' initialized successfully.")
    return restaurant


@router.put("/profile", response_model=RestaurantResponse)
def update_restaurant_profile(
    data: RestaurantUpdateRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    update_data = data.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(restaurant, field, val)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.put("/settings", response_model=RestaurantSettingsResponse)
def update_restaurant_settings(
    data: RestaurantSettingsBase,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    settings = restaurant.settings
    if not settings:
        settings = RestaurantSettings(restaurant_id=restaurant.id)
        db.add(settings)

    for field, val in data.model_dump().items():
        setattr(settings, field, val)

    db.commit()
    db.refresh(settings)
    return settings


@router.post("/seed-sample-data")
def trigger_seed_sample_data(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    seed_sample_menu_and_tables(db, restaurant)
    return {"message": "Sample categories, items, and tables loaded successfully."}


@router.post("/logo")
def upload_restaurant_logo(
    file: UploadFile = File(...),
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Uploads and stores the restaurant logo in the persistent local data directory."""
    if not file.content_type.startswith("image/"):
        raise AISRestroException("Invalid file format. Please upload an image (PNG, JPG, WEBP, SVG).")

    uploads_dir = Path("/app/data/uploads") if os.path.exists("/app/data") else Path(__file__).resolve().parents[4] / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    target_filename = f"logo_{restaurant.id[:8]}_{int(time.time())}.{ext}"
    target_path = uploads_dir / target_filename

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    logo_url = f"/uploads/{target_filename}"
    restaurant.logo_url = logo_url
    db.commit()
    db.refresh(restaurant)

    return {"message": "Logo uploaded successfully.", "logo_url": logo_url}


@router.post("/tax-preview")
def calculate_tax_preview(
    amount_paise: int = 10000,
    tax_rate_percent: float = 5.0,
    tax_type: str = "CGST_SGST",
    is_tax_inclusive: bool = False,
    is_tax_enabled: bool = True,
):
    """Calculates preview tax breakdown without persisting changes."""
    from app.business_logic.tax_service import calculate_tax_breakdown
    breakdown = calculate_tax_breakdown(
        net_amount_paise=amount_paise,
        tax_rate_percent=tax_rate_percent,
        tax_type=tax_type,
        is_tax_inclusive=is_tax_inclusive,
        is_tax_enabled=is_tax_enabled,
    )
    return breakdown


@router.get("/system-info")
def get_system_information(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    """Returns local system info, database path, storage sizes, and record stats."""
    from app.core.config import settings
    from app.business_logic.backup_service import get_sqlite_db_path, get_default_backup_dir
    from app.models.order import Order
    from app.models.cash import CashRegisterShift

    db_path = get_sqlite_db_path()
    db_size = db_path.stat().st_size if db_path.exists() else 0
    backup_dir = get_default_backup_dir()

    total_orders = db.query(func.count(Order.id)).scalar() or 0
    total_items = db.query(func.count(MenuItem.id)).scalar() or 0
    total_shifts = db.query(func.count(CashRegisterShift.id)).scalar() or 0

    return {
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database_engine": "SQLite",
        "database_file_path": str(db_path),
        "database_size_bytes": db_size,
        "database_size_display": f"{db_size / (1024 * 1024):.2f} MB" if db_size > 1024 * 1024 else f"{db_size / 1024:.1f} KB",
        "backup_directory": str(backup_dir),
        "total_orders": total_orders,
        "total_menu_items": total_items,
        "total_shifts": total_shifts,
    }
