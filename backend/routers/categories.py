from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Category, Transaction, CategoryGroup
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/categories", tags=["Categories"])

class CategoryGroupCreate(BaseModel):
    name: str

@router.get("/groups")
def get_groups(db: Session = Depends(get_db)):
    try:
        groups = db.query(CategoryGroup).order_by(CategoryGroup.name.asc()).all()
        logger.info(f"Fetched {len(groups)} category groups")
        return [{"id": g.id, "name": g.name} for g in groups]
    except Exception as e:
        logger.error(f"Failed to fetch category groups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch category groups")

@router.post("/groups")
def create_group(group: CategoryGroupCreate, db: Session = Depends(get_db)):
    existing = db.query(CategoryGroup).filter(CategoryGroup.name == group.name).first()
    if existing:
        return {"id": existing.id, "name": existing.name}
    new_group = CategoryGroup(name=group.name)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return {"id": new_group.id, "name": new_group.name}

@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(CategoryGroup).filter(CategoryGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.query(Category).filter(Category.group_id == group_id).update({"group_id": None}, synchronize_session=False)
    db.delete(group)
    db.commit()
    return {"message": "Group deleted"}

class CategoryCreate(BaseModel):
    name: str
    group_id: Optional[int] = None

@router.get("")
def get_categories(db: Session = Depends(get_db)):
    try:
        categories = db.query(Category).order_by(Category.name.asc()).all()
        logger.info(f"Fetched {len(categories)} categories")
        return [{"id": c.id, "name": c.name, "group_id": c.group_id} for c in categories]
    except Exception as e:
        logger.error(f"Failed to fetch categories: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch categories")

@router.post("")
def create_category(cat: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == cat.name).first()
    if existing:
        return {"id": existing.id, "name": existing.name}
        
    new_cat = Category(name=cat.name, group_id=cat.group_id)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return {"id": new_cat.id, "name": new_cat.name, "group_id": new_cat.group_id}

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[int] = None

@router.patch("/{category_id}")
def update_category(category_id: int, cat: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    if cat.name is not None:
        existing = db.query(Category).filter(Category.name == cat.name, Category.id != category_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        category.name = cat.name
        
    if cat.group_id is not None:
        if cat.group_id == 0:  # use 0 or something else? Better yet, if group_id is explicitly passed, let's accept null
             # but pydantic None is missing or null. Let's assume if it's passed we want to update.
             # Wait, how to unset group? Maybe pass -1
             pass
        category.group_id = cat.group_id if cat.group_id != -1 else None

    # Wait, simple dict iteration is better for patching:
    # Actually, we can just do:
    update_data = cat.dict(exclude_unset=True)
    if "name" in update_data:
        category.name = update_data["name"]
    if "group_id" in update_data:
        category.group_id = None if update_data["group_id"] == -1 else update_data["group_id"]

    db.commit()
    return {"id": category.id, "name": category.name, "group_id": category.group_id}

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Unlink transactions from this category
    db.query(Transaction).filter(Transaction.category_id == category_id).update({"category_id": None}, synchronize_session=False)
    
    # Delete category
    db.delete(category)
    db.commit()
    return {"message": "Category deleted successfully"}
