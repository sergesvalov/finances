from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Transaction, Category, Setting, TelegramRecipient
import pandas as pd
from typing import Optional
from datetime import datetime
import calendar
import json
import urllib.request
from pydantic import BaseModel

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/summary")
def get_analytics_summary(month: Optional[str] = Query(None), db: Session = Depends(get_db)):
    # Calculate start and end dates if month is provided
    start_date, end_date = None, None
    if month:
        try:
            year, m = map(int, month.split('-'))
            last_day = calendar.monthrange(year, m)[1]
            start_date = datetime(year, m, 1)
            end_date = datetime(year, m, last_day, 23, 59, 59)
        except ValueError:
            pass

    # We need all transactions to get available_months and basic filtering
    all_transactions = db.query(Transaction.execution_date).order_by(Transaction.execution_date.asc()).all()
    
    if not all_transactions:
         return {"available_months": [], "category_spending": [], "balance_dynamics": []}
         
    df_all = pd.DataFrame([{"date": t.execution_date} for t in all_transactions])
    available_months = sorted(df_all['date'].dt.strftime('%Y-%m').unique().tolist(), reverse=True)
    
    # Balance dynamics for the selected period
    tx_query = db.query(Transaction.execution_date, Transaction.balance).order_by(Transaction.execution_date.asc())
    if start_date and end_date:
        tx_query = tx_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    tx_list = tx_query.all()
    balance_dynamics = []
    if tx_list:
        df = pd.DataFrame([{
            "date": t.execution_date, 
            "balance": float(t.balance) if t.balance else 0.0
        } for t in tx_list])
        df['day'] = df['date'].dt.strftime('%Y-%m-%d')
        balance_df = df.sort_values('date').groupby('day').last().reset_index()
        balance_dynamics = [{"date": row['day'], "balance": row['balance']} for _, row in balance_df.iterrows()]
    
    # Category spending for the selected period
    category_spending = []
    cat_query = db.query(Category.name, func.sum(Transaction.amount).label("total_amount")) \
        .join(Transaction) \
        .filter(Transaction.amount < 0)
        
    if start_date and end_date:
        cat_query = cat_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    cat_query = cat_query.group_by(Category.name).all()
        
    for name, total in cat_query:
        category_spending.append({"name": name, "value": abs(float(total))})

    # Uncategorized spending
    uncat_query = db.query(func.sum(Transaction.amount).label("total")) \
        .filter(Transaction.amount < 0, Transaction.category_id == None)
        
    if start_date and end_date:
        uncat_query = uncat_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    uncat_total = uncat_query.scalar()
        
    if uncat_total:
         category_spending.append({"name": "Uncategorized", "value": abs(float(uncat_total))})
         
    # Total Income
    income_query = db.query(func.sum(Transaction.amount).label("total")) \
        .filter(Transaction.amount > 0)
        
    if start_date and end_date:
        income_query = income_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    total_income = income_query.scalar() or 0.0
         
    return {
        "available_months": available_months,
        "category_spending": category_spending,
        "balance_dynamics": balance_dynamics,
        "total_income": float(total_income)
    }

class ReportRequest(BaseModel):
    month: Optional[str] = None

@router.post("/report/telegram")
def send_telegram_report(req: ReportRequest, db: Session = Depends(get_db)):
    token_setting = db.query(Setting).filter(Setting.key == "telegram_bot_token").first()
    if not token_setting or not token_setting.value:
        raise HTTPException(status_code=400, detail="Telegram bot token not configured. Please set it in Administration.")
        
    recipients = db.query(TelegramRecipient).all()
    if not recipients:
        raise HTTPException(status_code=400, detail="No Telegram recipients configured. Please add them in Administration.")
        
    data = get_analytics_summary(month=req.month, db=db)
    month_str = req.month if req.month else "All Time"
    
    total_spent = sum(item["value"] for item in data.get("category_spending", []))
    total_income = data.get("total_income", 0.0)
    
    current_balance = 0.0
    if len(data.get("balance_dynamics", [])) > 0:
         current_balance = data["balance_dynamics"][-1]["balance"]
    
    lines = [f"📊 <b>Monthly Finance Report ({month_str})</b>", ""]
    lines.append(f"🟢 <b>Income:</b> +€{total_income:.2f}")
    lines.append(f"🔴 <b>Expenses:</b> -€{total_spent:.2f}")
    lines.append(f"💳 <b>Current Balance:</b> €{current_balance:.2f}")
    lines.append("")
    lines.append("🗂 <b>Category Breakdown (Expenses):</b>")
    
    spending = sorted(data.get("category_spending", []), key=lambda x: x["value"], reverse=True)
    for item in spending:
        lines.append(f"  🔹 {item['name']}: €{item['value']:.2f}")
        
    message = "\n".join(lines)
    url = f"https://api.telegram.org/bot{token_setting.value}/sendMessage"
    
    success_count = 0
    from fastapi import HTTPException
    for r in recipients:
        payload = json.dumps({
            "chat_id": r.telegram_id,
            "text": message,
            "parse_mode": "HTML"
        }).encode("utf-8")
        
        try:
            req_obj = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req_obj) as response:
                if response.getcode() == 200:
                    success_count += 1
        except Exception as e:
            print(f"Failed to send to {r.telegram_id}: {e}")
            
    if success_count == 0:
        raise HTTPException(status_code=500, detail="Failed to send report to any recipients. Check bot token and IDs.")
        
    return {"message": f"Report successfully sent to {success_count} recipients."}
