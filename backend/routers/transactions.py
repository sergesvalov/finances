from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from datetime import datetime
import calendar
import os
import uuid
import shutil
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Transaction, Category, Tag
from schemas import Transaction as TransactionSchema
from pydantic import BaseModel

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

RECEIPTS_DIR = "/app/receipts"
MAX_RECEIPT_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "application/pdf"}

os.makedirs(RECEIPTS_DIR, exist_ok=True)


@router.get("", response_model=dict)
def get_transactions(
    skip: int = 0, 
    limit: int = 50, 
    search: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    month: Optional[str] = None,
    date: Optional[str] = None,
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
            
    if tag:
        query = query.filter(Transaction.tags.any(Tag.name == tag))
            
    if month:
        try:
            year, m = map(int, month.split('-'))
            last_day = calendar.monthrange(year, m)[1]
            start_date = datetime(year, m, 1)
            end_date = datetime(year, m, last_day, 23, 59, 59)
            query = query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        except ValueError:
            pass
            
    if date:
        try:
            d = datetime.strptime(date, '%Y-%m-%d')
            end_d = datetime(d.year, d.month, d.day, 23, 59, 59)
            query = query.filter(Transaction.execution_date >= d, Transaction.execution_date <= end_d)
        except ValueError:
            pass
            
    total = query.count()
    transactions = query.order_by(Transaction.execution_date.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": [
            {
                "id": t.id,
                "execution_date": t.execution_date.isoformat(),
                "description": t.description,
                "amount": float(t.amount),
                "currency": t.currency,
                "balance": float(t.balance) if t.balance else 0.0,
                "category": t.category.name if t.category else None,
                "tags": [{"id": tag.id, "name": tag.name} for tag in t.tags],
                "receipt_path": t.receipt_path,
            } for t in transactions
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/{transaction_id}/receipt", response_model=dict)
async def upload_receipt(transaction_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: images and PDF."
        )

    # Read file and check size
    contents = await file.read()
    if len(contents) > MAX_RECEIPT_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 15 MB.")

    # Delete old receipt file if exists
    if tx.receipt_path:
        old_file = os.path.join(RECEIPTS_DIR, tx.receipt_path)
        if os.path.isfile(old_file):
            os.remove(old_file)

    # Generate unique filename preserving extension
    ext = os.path.splitext(file.filename or "")[1] or (".pdf" if file.content_type == "application/pdf" else ".jpg")
    filename = f"{transaction_id}_{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(RECEIPTS_DIR, filename)

    with open(dest_path, "wb") as f:
        f.write(contents)

    tx.receipt_path = filename
    db.commit()

    return {"message": "Receipt uploaded successfully", "receipt_path": filename}


@router.delete("/{transaction_id}/receipt", response_model=dict)
def delete_receipt(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not tx.receipt_path:
        raise HTTPException(status_code=404, detail="No receipt attached to this transaction")

    file_path = os.path.join(RECEIPTS_DIR, tx.receipt_path)
    if os.path.isfile(file_path):
        os.remove(file_path)

    tx.receipt_path = None
    db.commit()

    return {"message": "Receipt deleted successfully"}


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


@router.post("/{transaction_id}/tags/{tag_id}")
def add_tag_to_transaction(transaction_id: int, tag_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
        
    if tag not in tx.tags:
        tx.tags.append(tag)
        db.commit()
        
    return {"message": "Tag added"}


@router.delete("/{transaction_id}/tags/{tag_id}")
def remove_tag_from_transaction(transaction_id: int, tag_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag or tag not in tx.tags:
        raise HTTPException(status_code=404, detail="Tag not found on transaction")
        
    tx.tags.remove(tag)
    db.commit()
    return {"message": "Tag removed"}
