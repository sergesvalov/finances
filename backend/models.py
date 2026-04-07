from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base

transaction_tags = Table(
    'transaction_tags',
    Base.metadata,
    Column('transaction_id', Integer, ForeignKey('transactions.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    transactions = relationship("Transaction", secondary=transaction_tags, back_populates="tags")

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


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    amount = Column(Numeric, nullable=False)
    note = Column(String, nullable=True)

    transaction = relationship("Transaction", back_populates="splits")
    category = relationship("Category")


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
    receipt_path = Column(String, nullable=True)

    category = relationship("Category", back_populates="transactions")
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions")
    splits = relationship("TransactionSplit", back_populates="transaction", cascade="all, delete-orphan")
