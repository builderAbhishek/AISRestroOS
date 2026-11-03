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
        .filter(MenuCategory.restaurant_id == restaurant.id)
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
        name=data.name,
        description=data.description,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    data: CategoryUpdate,
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

    db.delete(category)
    db.commit()
    return None


# ==================== MENU ITEMS ====================

@router.get("/items", response_model=List[MenuItemResponse])
def list_menu_items(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    is_veg: Optional[bool] = None,
    available_only: Optional[bool] = None,
    restaurant: Restaurant = Depends(require_restaurant),
    db: Session = Depends(get_db),
):
    query = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant.id)

    if category_id:
        query = query.filter(MenuItem.category_id == category_id)
    if is_veg is not None:
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
        .filter(MenuCategory.id == data.category_id, MenuCategory.restaurant_id == restaurant.id)
        .first()
    )
    if not cat:
        raise EntityNotFoundException("MenuCategory", data.category_id)

    item = MenuItem(
        restaurant_id=restaurant.id,
        category_id=data.category_id,
        name=data.name,
        item_code=data.item_code,
        description=data.description,
        base_price_paise=data.base_price_paise,
        is_veg=data.is_veg,
        is_available=data.is_available,
        has_variants=bool(data.variants),
        image_url=data.image_url,
        sort_order=data.sort_order,
    )
    db.add(item)
    db.flush()

    if data.variants:
        for v in data.variants:
            variant = MenuVariant(
                item_id=item.id,
                name=v.name,
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
        .filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id)
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
        .filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant.id)
        .first()
    )
    if not item:
        raise EntityNotFoundException("MenuItem", item_id)

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(item, field, val)

    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}/toggle-availability", response_model=MenuItemResponse)
def toggle_item_availability(
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

    db.delete(item)
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
        name=data.name,
        min_selection=data.min_selection,
        max_selection=data.max_selection,
        is_required=data.is_required,
    )
    db.add(group)
    db.flush()

    for a in data.addons:
        addon = Addon(
            addon_group_id=group.id,
            name=a.name,
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
        name=data.name,
        price_paise=data.price_paise,
        is_available=data.is_available,
    )
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon
