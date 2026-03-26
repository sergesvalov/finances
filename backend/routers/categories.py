from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Category
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
