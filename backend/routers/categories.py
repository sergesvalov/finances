from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Category, Transaction
from pydantic import BaseModel

router = APIRouter(prefix="/api/categories", tags=["Categories"])

class CategoryCreate(BaseModel):
    name: str

@router.get("")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).order_by(Category.name.asc()).all()
    return [{"id": c.id, "name": c.name} for c in categories]

@router.post("")
def create_category(cat: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == cat.name).first()
    if existing:
        return {"id": existing.id, "name": existing.name}
        
    new_cat = Category(name=cat.name)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return {"id": new_cat.id, "name": new_cat.name}

class CategoryUpdate(BaseModel):
    name: str

@router.patch("/{category_id}")
def rename_category(category_id: int, cat: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Check if a category with the new name already exists and it's not the same one
    existing = db.query(Category).filter(Category.name == cat.name, Category.id != category_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
        
    category.name = cat.name
    db.commit()
    return {"id": category.id, "name": category.name}

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
