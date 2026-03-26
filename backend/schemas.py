from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int

    class Config:
        orm_mode = True

class TransactionBase(BaseModel):
    execution_date: datetime
    description: str
    amount: float
    currency: str
    balance: float
    category_id: Optional[int] = None
    original_hash: str

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    category: Optional[Category] = None

    class Config:
        orm_mode = True
