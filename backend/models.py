from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    transactions = relationship("Transaction", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    execution_date = Column(DateTime, index=True)
    description = Column(String)
    amount = Column(Numeric, nullable=False)
    currency = Column(String, nullable=False)
    balance = Column(Numeric)
    category_id = Column(Integer, ForeignKey("categories.id"))
    original_hash = Column(String, unique=True, index=True)

    category = relationship("Category", back_populates="transactions")
