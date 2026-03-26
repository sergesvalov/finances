from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Transaction, Category
import pandas as pd

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    # 1. Traty po miesyatsam (Spending by month)
    # Using pandas is easier if data is huge, but DB query is fine for small
    transactions = db.query(
        Transaction.execution_date, 
        Transaction.amount, 
        Transaction.balance
    ).order_by(Transaction.execution_date.asc()).all()
    
    if not transactions:
         return {"monthly_spending": [], "category_spending": [], "balance_dynamics": []}
         
    df = pd.DataFrame([{
        "date": t.execution_date, 
        "amount": float(t.amount),
        "balance": float(t.balance) if t.balance else 0.0
    } for t in transactions])
    
    # Negative amounts are spending usually, filter them
    df['month'] = df['date'].dt.strftime('%Y-%m')
    spending_df = df[df['amount'] < 0]
    
    monthly_spending = spending_df.groupby('month')['amount'].sum().abs().reset_index().to_dict('records')
    
    # Balance dynamics (last transaction balance per month/day)
    df['day'] = df['date'].dt.strftime('%Y-%m-%d')
    balance_df = df.sort_values('date').groupby('day').last().reset_index()
    balance_dynamics = [{"date": row['day'], "balance": row['balance']} for _, row in balance_df.iterrows()]
    
    # 2. Traty po kategoriyam (Spending by category)
    # Using SQLAlchemy for joining Categories
    category_spending = []
    cat_query = db.query(Category.name, func.sum(Transaction.amount).label("total_amount")) \
        .join(Transaction) \
        .filter(Transaction.amount < 0) \
        .group_by(Category.name) \
        .all()
        
    for name, total in cat_query:
        category_spending.append({"name": name, "value": abs(float(total))})

    # also include un_categorized
    uncat_query = db.query(func.sum(Transaction.amount).label("total")) \
        .filter(Transaction.amount < 0, Transaction.category_id == None) \
        .scalar()
        
    if uncat_query:
         category_spending.append({"name": "Uncategorized", "value": abs(float(uncat_query))})
         
    return {
        "monthly_spending": monthly_spending,
        "category_spending": category_spending,
        "balance_dynamics": balance_dynamics
    }
