from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class TelegramRecipient(Base):
    __tablename__ = "telegram_recipients"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True)
    name = Column(String)

class CategoryGroup(Base):
    __tablename__ = "category_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    categories = relationship("Category", back_populates="group")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    group_id = Column(Integer, ForeignKey("category_groups.id"), nullable=True)

    group = relationship("CategoryGroup", back_populates="categories")
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
