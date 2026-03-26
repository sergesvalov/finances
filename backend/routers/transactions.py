from fastapi import APIRouter, Depends, Query, HTTPException
from datetime import datetime
import calendar
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Transaction, Category
from schemas import Transaction as TransactionSchema
from pydantic import BaseModel

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=dict)
def get_transactions(
    skip: int = 0, 
    limit: int = 50, 
    search: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
        
    if category:
        if category == "Uncategorized":
            query = query.filter(Transaction.category_id == None)
        else:
            query = query.join(Category).filter(Category.name == category)
            
    if month:
        try:
            year, m = map(int, month.split('-'))
            last_day = calendar.monthrange(year, m)[1]
            start_date = datetime(year, m, 1)
            end_date = datetime(year, m, last_day, 23, 59, 59)
            query = query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        except ValueError:
            pass
            
    total = query.count()
    transactions = query.order_by(Transaction.execution_date.desc()).offset(skip).limit(limit).all()
    
    # Return paginated format
    return {
        "items": [
            {
                "id": t.id,
                "execution_date": t.execution_date.isoformat(),
                "description": t.description,
                "amount": float(t.amount),
                "currency": t.currency,
                "balance": float(t.balance) if t.balance else 0.0,
                "category": t.category.name if t.category else None
            } for t in transactions
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.patch("/{transaction_id}/category", response_model=dict)
def update_category(transaction_id: int, category_id: Optional[int] = None, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if category_id is not None:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
        tx.category_id = category_id
        cat_name = cat.name
        similar_count = db.query(Transaction).filter(
            Transaction.description == tx.description,
            Transaction.id != tx.id,
            (Transaction.category_id != category_id) | (Transaction.category_id.is_(None))
        ).count()
    else:
        tx.category_id = None
        cat_name = None
        similar_count = db.query(Transaction).filter(
            Transaction.description == tx.description,
            Transaction.id != tx.id,
            Transaction.category_id != None
        ).count()
        
    db.commit()
    
    return {"message": "Category updated successfully", "category": cat_name, "similar_count": similar_count, "description": tx.description}

class BulkCategoryUpdate(BaseModel):
    description: str
    category_id: Optional[int] = None

@router.post("/bulk_category", response_model=dict)
def bulk_update_category(data: BulkCategoryUpdate, db: Session = Depends(get_db)):
    if data.category_id is not None:
        cat = db.query(Category).filter(Category.id == data.category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found")
            
    updated_count = db.query(Transaction).filter(
        Transaction.description == data.description
    ).update({"category_id": data.category_id}, synchronize_session=False)
    
    db.commit()
    return {"message": f"Updated {updated_count} transactions"}

