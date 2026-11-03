from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_restaurant
from app.models.restaurant import Restaurant
from app.models.menu import MenuCategory, MenuItem, MenuVariant, AddonGroup, Addon
from app.schemas.menu import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoryReorderRequest,
    MenuItemCreate,
    MenuItemUpdate,
    MenuItemResponse,
    AddonGroupCreate,
    AddonGroupResponse,
    AddonCreate,
    AddonResponse,
)
from app.core.exceptions import EntityNotFoundException

router = APIRouter(prefix="/menu", tags=["Menu Management"])


# ==================== CATEGORIES ====================

@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    return (
        db.query(MenuCategory)
        .filter(
            MenuCategory.restaurant_id == restaurant.id,
            MenuCategory.is_deleted == False,
        )
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    category = MenuCategory(
        restaurant_id=restaurant.id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        sort_order=data.sort_order,
        is_active=data.is_active,
        is_deleted=False,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/reorder", response_model=List[CategoryResponse])
def reorder_categories(
    data: CategoryReorderRequest,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    for item in data.items:
        cat = (
            db.query(MenuCategory)
            .filter(MenuCategory.id == item.id, MenuCategory.restaurant_id == restaurant.id)
            .first()
        )
        if cat:
            cat.sort_order = item.sort_order
    db.commit()
    return (
        db.query(MenuCategory)
        .filter(MenuCategory.restaurant_id == restaurant.id, MenuCategory.is_deleted == False)
        .order_by(MenuCategory.sort_order, MenuCategory.name)
        .all()
    )


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    data: CategoryUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    category = (
        db.query(MenuCategory)
        .filter(
            MenuCategory.id == category_id,
            MenuCategory.restaurant_id == restaurant.id,
            MenuCategory.is_deleted == False,
        )
        .first()
    )
    if not category:
        raise EntityNotFoundException("MenuCategory", category_id)

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(category, field, val)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    category = (
        db.query(MenuCategory)
        .filter(MenuCategory.id == category_id, MenuCategory.restaurant_id == restaurant.id)
        .first()
    )
    if not category:
        raise EntityNotFoundException("MenuCategory", category_id)

    # Soft delete category to preserve historical order references
    category.is_deleted = True
    category.is_active = False

    # Also soft-delete active items in this category
    items = (
        db.query(MenuItem)
        .filter(MenuItem.category_id == category.id, MenuItem.restaurant_id == restaurant.id)
        .all()
    )
    for it in items:
        it.is_deleted = True
        it.is_available = False

    db.commit()
    return None


# ==================== MENU ITEMS ====================

@router.get("/items", response_model=List[MenuItemResponse])
def list_menu_items(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    is_veg: Optional[bool] = None,
    item_type: Optional[str] = None,
    available_only: Optional[bool] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant.id,
        MenuItem.is_deleted == False,
    )

    if category_id and category_id != "all":
        query = query.filter(MenuItem.category_id == category_id)
    if item_type:
        query = query.filter(MenuItem.item_type == item_type)
    elif is_veg is not None:
        query = query.filter(MenuItem.is_veg == is_veg)
    if available_only is True:
        query = query.filter(MenuItem.is_available == True)
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            (MenuItem.name.ilike(search_term)) | (MenuItem.item_code.ilike(search_term))
        )

    return query.order_by(MenuItem.sort_order, MenuItem.name).all()


@router.post("/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    data: MenuItemCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    # Verify category
    cat = (
        db.query(MenuCategory)
        .filter(
            MenuCategory.id == data.category_id,
            MenuCategory.restaurant_id == restaurant.id,
            MenuCategory.is_deleted == False,
        )
        .first()
    )
    if not cat:
        raise EntityNotFoundException("MenuCategory", data.category_id)

    is_veg_val = (data.item_type == "veg") if data.item_type else data.is_veg

    item = MenuItem(
        restaurant_id=restaurant.id,
        category_id=data.category_id,
        name=data.name.strip(),
        item_code=data.item_code.strip() if data.item_code else None,
        description=data.description.strip() if data.description else None,
        base_price_paise=data.base_price_paise,
        is_veg=is_veg_val,
        item_type=data.item_type or ("veg" if is_veg_val else "non_veg"),
        is_available=data.is_available,
        is_recommended=data.is_recommended,
        is_bestseller=data.is_bestseller,
        is_tax_inclusive=data.is_tax_inclusive,
        tax_rate_override_percent=data.tax_rate_override_percent,
        preparation_time_minutes=data.preparation_time_minutes,
        has_variants=bool(data.variants),
        image_url=data.image_url,
        sort_order=data.sort_order,
        is_deleted=False,
    )
    db.add(item)
    db.flush()

    if data.variants:
        for v in data.variants:
            variant = MenuVariant(
                item_id=item.id,
                name=v.name.strip(),
                price_paise=v.price_paise,
                is_default=v.is_default,
                is_available=v.is_available,
            )
            db.add(variant)

    if data.addon_group_ids:
        groups = (
            db.query(AddonGroup)
            .filter(AddonGroup.id.in_(data.addon_group_ids), AddonGroup.restaurant_id == restaurant.id)
            .all()
        )
        item.addon_groups.extend(groups)

    db.commit()
    db.refresh(item)
    return item


@router.get("/items/{item_id}", response_model=MenuItemResponse)
def get_menu_item(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_deleted == False,
        )
        .first()
    )
    if not item:
        raise EntityNotFoundException("MenuItem", item_id)
    return item


@router.put("/items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    item_id: str,
    data: MenuItemUpdate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_deleted == False,
        )
        .first()
    )
    if not item:
        raise EntityNotFoundException("MenuItem", item_id)

    # Check category if changing
    if data.category_id and data.category_id != item.category_id:
        cat = (
            db.query(MenuCategory)
            .filter(
                MenuCategory.id == data.category_id,
                MenuCategory.restaurant_id == restaurant.id,
                MenuCategory.is_deleted == False,
            )
            .first()
        )
        if not cat:
            raise EntityNotFoundException("MenuCategory", data.category_id)
        item.category_id = data.category_id

    # Update simple scalar fields
    update_data = data.model_dump(exclude_unset=True, exclude={"variants", "addon_group_ids"})
    for field, val in update_data.items():
        setattr(item, field, val)

    # Sync is_veg with item_type
    if data.item_type is not None:
        item.is_veg = (data.item_type == "veg")
    elif data.is_veg is not None:
        item.item_type = "veg" if data.is_veg else "non_veg"

    # Handle variants if provided
    if data.variants is not None:
        # Clear existing variants and recreate
        db.query(MenuVariant).filter(MenuVariant.item_id == item.id).delete()
        db.flush()
        item.has_variants = bool(data.variants)
        for v in data.variants:
            variant = MenuVariant(
                item_id=item.id,
                name=v.name.strip(),
                price_paise=v.price_paise,
                is_default=v.is_default,
                is_available=v.is_available,
            )
            db.add(variant)

    # Handle addon groups if provided
    if data.addon_group_ids is not None:
        item.addon_groups.clear()
        if data.addon_group_ids:
            groups = (
                db.query(AddonGroup)
                .filter(AddonGroup.id.in_(data.addon_group_ids), AddonGroup.restaurant_id == restaurant.id)
                .all()
            )
            item.addon_groups.extend(groups)

    db.commit()
    db.refresh(item)
    return item


@router.post("/items/{item_id}/duplicate", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def duplicate_menu_item(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    source = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_deleted == False,
        )
        .first()
    )
    if not source:
        raise EntityNotFoundException("MenuItem", item_id)

    duplicated = MenuItem(
        restaurant_id=restaurant.id,
        category_id=source.category_id,
        name=f"{source.name} (Copy)",
        item_code=f"{source.item_code}-CPY" if source.item_code else None,
        description=source.description,
        base_price_paise=source.base_price_paise,
        is_veg=source.is_veg,
        item_type=source.item_type,
        is_available=source.is_available,
        is_recommended=source.is_recommended,
        is_bestseller=source.is_bestseller,
        is_tax_inclusive=source.is_tax_inclusive,
        tax_rate_override_percent=source.tax_rate_override_percent,
        preparation_time_minutes=source.preparation_time_minutes,
        has_variants=source.has_variants,
        image_url=source.image_url,
        sort_order=source.sort_order + 1,
        is_deleted=False,
    )
    db.add(duplicated)
    db.flush()

    for v in source.variants:
        new_v = MenuVariant(
            item_id=duplicated.id,
            name=v.name,
            price_paise=v.price_paise,
            is_default=v.is_default,
            is_available=v.is_available,
        )
        db.add(new_v)

    duplicated.addon_groups.extend(source.addon_groups)
    db.commit()
    db.refresh(duplicated)
    return duplicated


@router.patch("/items/{item_id}/toggle-availability", response_model=MenuItemResponse)
def toggle_item_availability(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_deleted == False,
        )
        .first()
    )
    if not item:
        raise EntityNotFoundException("MenuItem", item_id)

    item.is_available = not item.is_available
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    item_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    item = (
        db.query(MenuItem)
        .filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id)
        .first()
    )
    if not item:
        raise EntityNotFoundException("MenuItem", item_id)

    # Soft delete to preserve historical order and invoice records
    item.is_deleted = True
    item.is_available = False
    db.commit()
    return None


# ==================== ADDON GROUPS ====================

@router.get("/addon-groups", response_model=List[AddonGroupResponse])
def list_addon_groups(
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    return (
        db.query(AddonGroup)
        .filter(AddonGroup.restaurant_id == restaurant.id)
        .all()
    )


@router.post("/addon-groups", response_model=AddonGroupResponse, status_code=status.HTTP_201_CREATED)
def create_addon_group(
    data: AddonGroupCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    group = AddonGroup(
        restaurant_id=restaurant.id,
        name=data.name.strip(),
        min_selection=data.min_selection,
        max_selection=data.max_selection,
        is_required=data.is_required,
    )
    db.add(group)
    db.flush()

    for a in data.addons:
        addon = Addon(
            addon_group_id=group.id,
            name=a.name.strip(),
            price_paise=a.price_paise,
            is_available=a.is_available,
        )
        db.add(addon)

    db.commit()
    db.refresh(group)
    return group


@router.post("/addon-groups/{group_id}/addons", response_model=AddonResponse, status_code=status.HTTP_201_CREATED)
def add_addon_to_group(
    group_id: str,
    data: AddonCreate,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant.id)
        .first()
    )
    if not group:
        raise EntityNotFoundException("AddonGroup", group_id)

    addon = Addon(
        addon_group_id=group.id,
        name=data.name.strip(),
        price_paise=data.price_paise,
        is_available=data.is_available,
    )
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon


@router.delete("/addon-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_addon_group(
    group_id: str,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    group = (
        db.query(AddonGroup)
        .filter(AddonGroup.id == group_id, AddonGroup.restaurant_id == restaurant.id)
        .first()
    )
    if not group:
        raise EntityNotFoundException("AddonGroup", group_id)

    db.delete(group)
    db.commit()
    return None

