from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Transaction, Category, CategoryGroup, Setting, TelegramRecipient
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
    prev_start_date, prev_end_date = None, None
    if month:
        try:
            year, m = map(int, month.split('-'))
            last_day = calendar.monthrange(year, m)[1]
            start_date = datetime(year, m, 1)
            end_date = datetime(year, m, last_day, 23, 59, 59)
            
            prev_year = year if m > 1 else year - 1
            prev_m = m - 1 if m > 1 else 12
            prev_last_day = calendar.monthrange(prev_year, prev_m)[1]
            prev_start_date = datetime(prev_year, prev_m, 1)
            prev_end_date = datetime(prev_year, prev_m, prev_last_day, 23, 59, 59)
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
    cat_query = db.query(Category.name, CategoryGroup.name.label("group_name"), func.sum(Transaction.amount).label("total_amount")) \
        .join(Transaction) \
        .outerjoin(CategoryGroup, Category.group_id == CategoryGroup.id) \
        .filter(Transaction.amount < 0)
        
    if start_date and end_date:
        cat_query = cat_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    cat_query = cat_query.group_by(Category.name, CategoryGroup.name).all()
        
    raw_categories = []
    for cat_name, group_name, total in cat_query:
        raw_categories.append({"name": cat_name, "group": group_name or "Other expenses", "value": abs(float(total))})

    uncat_query = db.query(func.sum(Transaction.amount).label("total")) \
        .filter(Transaction.amount < 0, Transaction.category_id == None)
        
    if start_date and end_date:
        uncat_query = uncat_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    uncat_total = uncat_query.scalar()

    if uncat_total:
         raw_categories.append({"name": "Uncategorized", "group": "Uncategorized", "value": abs(float(uncat_total))})
         
    grouped = {}
    for item in raw_categories:
        g = item["group"]
        if g not in grouped:
            grouped[g] = {"name": g, "value": 0.0, "subcategories": []}
        grouped[g]["value"] += item["value"]
        grouped[g]["subcategories"].append({"name": item["name"], "value": item["value"]})
        
    category_spending = list(grouped.values())
    for group in category_spending:
        group["subcategories"] = sorted(group["subcategories"], key=lambda x: x["value"], reverse=True)
         
    # Total Income
    income_query = db.query(func.sum(Transaction.amount).label("total")) \
        .filter(Transaction.amount > 0)
        
    if start_date and end_date:
        income_query = income_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    total_income = income_query.scalar() or 0.0
         
    previous_total_expenses = 0.0
    previous_total_income = 0.0
    
    if prev_start_date and prev_end_date:
        prev_exp = db.query(func.sum(Transaction.amount)).filter(Transaction.amount < 0, Transaction.execution_date >= prev_start_date, Transaction.execution_date <= prev_end_date).scalar()
        previous_total_expenses = abs(float(prev_exp)) if prev_exp else 0.0
        
        prev_inc = db.query(func.sum(Transaction.amount)).filter(Transaction.amount > 0, Transaction.execution_date >= prev_start_date, Transaction.execution_date <= prev_end_date).scalar()
        previous_total_income = float(prev_inc) if prev_inc else 0.0
        
    return {
        "available_months": available_months,
        "category_spending": category_spending,
        "balance_dynamics": balance_dynamics,
        "total_income": float(total_income),
        "previous_total_expenses": previous_total_expenses,
        "previous_total_income": previous_total_income
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
    
    spending = sorted(data.get("category_spending", []), key=lambda x: x["value"], reverse=True)
    for group in spending:
        lines.append(f"📁 <b>{group['name']}</b>: €{group['value']:.2f}")
        for sub in group.get("subcategories", []):
            lines.append(f"   🔹 {sub['name']}: €{sub['value']:.2f}")
        lines.append("")
        
    message = "\n".join(lines)
    url = f"https://api.telegram.org/bot{token_setting.value.strip()}/sendMessage"
    
    success_count = 0
    from fastapi import HTTPException
    import urllib.error
    last_error = "Unknown error"
    
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
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8')
            except:
                err_body = "Could not read response body"
            print(f"Telegram API Error for {r.telegram_id}: {e.code} - {err_body}")
            last_error = f"Telegram {e.code}: {err_body}"
        except Exception as e:
            print(f"Failed to send to {r.telegram_id}: {e}")
            last_error = str(e)
            
    if success_count == 0:
        raise HTTPException(status_code=500, detail=f"Failed to send report. Error: {last_error}")
        
    return {"message": f"Report successfully sent to {success_count} recipients."}
