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
    income_expenses_dynamics = []
    if tx_list:
        df = pd.DataFrame([{
            "date": t.execution_date, 
            "balance": float(t.balance) if t.balance else 0.0
        } for t in tx_list])
        df['day'] = df['date'].dt.strftime('%Y-%m-%d')
        balance_df = df.sort_values('date').groupby('day').last().reset_index()
        balance_dynamics = [{"date": row['day'], "balance": row['balance']} for _, row in balance_df.iterrows()]
        
    flow_tx_query = db.query(Transaction.execution_date, Transaction.amount)
    if start_date and end_date:
        flow_tx_query = flow_tx_query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
    flow_list = flow_tx_query.all()
    
    if flow_list:
        flow_df = pd.DataFrame([{
            "date": t.execution_date,
            "amount": float(t.amount)
        } for t in flow_list])
        flow_df['day'] = flow_df['date'].dt.strftime('%Y-%m-%d')
        flow_df['expense'] = flow_df['amount'].apply(lambda x: abs(x) if x < 0 else 0.0)
        flow_df['income'] = flow_df['amount'].apply(lambda x: x if x > 0 else 0.0)
        flow_grouped = flow_df.groupby('day')[['expense', 'income']].sum().reset_index()
        income_expenses_dynamics = [{"date": row['day'], "expense": row['expense'], "income": row['income']} for _, row in flow_grouped.iterrows()]
    
    
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
        
    daily_expenses = []
    if start_date and end_date:
        exp_query = db.query(
            func.date(Transaction.execution_date).label('day'),
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.amount < 0,
            Transaction.execution_date >= start_date,
            Transaction.execution_date <= end_date
        ).group_by(func.date(Transaction.execution_date)).all()
        for d, t in exp_query:
            daily_expenses.append({"date": str(d), "value": abs(float(t))})
            
    cumulative_spending = []
    if start_date and end_date and prev_start_date:
        days_in_month = (end_date - start_date).days + 1
        curr_query = db.query(
            func.extract('day', Transaction.execution_date).label('day'),
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.amount < 0,
            Transaction.execution_date >= start_date,
            Transaction.execution_date <= end_date
        ).group_by(func.extract('day', Transaction.execution_date)).all()
        curr_map = {int(d): abs(float(t)) for d, t in curr_query}
        prev_query = db.query(
            func.extract('day', Transaction.execution_date).label('day'),
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.amount < 0,
            Transaction.execution_date >= prev_start_date,
            Transaction.execution_date <= prev_end_date
        ).group_by(func.extract('day', Transaction.execution_date)).all()
        prev_map = {int(d): abs(float(t)) for d, t in prev_query}
        
        curr_cum = 0.0
        prev_cum = 0.0
        today_day = None
        now = datetime.now()
        if start_date.year == now.year and start_date.month == now.month:
            today_day = now.day
            
        for day in range(1, days_in_month + 1):
            curr_val = curr_map.get(day, 0.0)
            prev_val = prev_map.get(day, 0.0)
            curr_cum += curr_val
            prev_cum += prev_val
            item = {"day": day, "previous": prev_cum}
            if today_day is None or day <= today_day:
                item["current"] = curr_cum
            cumulative_spending.append(item)
            
    nodes = []
    links = []
    node_idx = {}
    
    def get_node(name):
        if name not in node_idx:
            nodes.append({"name": name})
            node_idx[name] = len(nodes) - 1
        return node_idx[name]

    total_spent = sum(g["value"] for g in category_spending)
    total_inc = float(total_income)
    
    source_name = "Income"
    if total_inc == 0 and total_spent > 0:
        source_name = "Available Funds"
    
    source_idx = get_node(source_name)
    
    for g in category_spending:
        g_idx = get_node(g["name"])
        links.append({"source": source_idx, "target": g_idx, "value": g["value"]})
        for sub in g["subcategories"]:
            sub_name = sub["name"]
            if sub_name == g["name"]:
                sub_name = f"{sub_name} (Category)"
            sub_idx = get_node(sub_name)
            links.append({"source": g_idx, "target": sub_idx, "value": sub["value"]})
            
    if source_name == "Income" and total_inc > total_spent:
        savings_idx = get_node("Savings")
        links.append({"source": source_idx, "target": savings_idx, "value": total_inc - total_spent})
        
    sankey_data = {"nodes": nodes, "links": links}

    return {
        "available_months": available_months,
        "category_spending": category_spending,
        "balance_dynamics": balance_dynamics,
        "total_income": float(total_income),
        "previous_total_expenses": previous_total_expenses,
        "previous_total_income": previous_total_income,
        "daily_expenses": daily_expenses,
        "cumulative_spending": cumulative_spending,
        "sankey_data": sankey_data,
        "income_expenses_dynamics": income_expenses_dynamics
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
    
    raw_token = token_setting.value.strip().strip('"').strip("'").strip()
    # Handle if user pasted full URL
    if "api.telegram.org" in raw_token:
        import re
        match = re.search(r'bot([^/]+)', raw_token)
        if match:
            raw_token = match.group(1)
            
    # Handle if user pasted "bot" prefix
    if raw_token.lower().startswith("bot"):
        raw_token = raw_token[3:].strip()
        
    if ":" not in raw_token:
        raise HTTPException(status_code=400, detail="Telegram Token format is invalid. It MUST contain a colon ':', e.g., '123456789:ABCDefgh...'. Please check your Settings.")
        
    url = f"https://api.telegram.org/bot{raw_token}/sendMessage"    
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

@router.get("/payees")
def get_top_payees(month: Optional[str] = Query(None), limit: int = 10, db: Session = Depends(get_db)):
    start_date, end_date = None, None
    if month:
        try:
            year, m = map(int, month.split('-'))
            last_day = calendar.monthrange(year, m)[1]
            start_date = datetime(year, m, 1)
            end_date = datetime(year, m, last_day, 23, 59, 59)
        except ValueError:
            pass

    query = db.query(
        Transaction.description,
        func.sum(Transaction.amount).label("total")
    ).filter(Transaction.amount < 0)
    
    if start_date and end_date:
        query = query.filter(Transaction.execution_date >= start_date, Transaction.execution_date <= end_date)
        
    results = query.group_by(Transaction.description).order_by(func.sum(Transaction.amount).asc()).limit(limit).all()
    
    return [{"name": name, "value": abs(float(total))} for name, total in results if name]

@router.get("/subscriptions")
def get_subscriptions(db: Session = Depends(get_db)):
    tx_list = db.query(Transaction.execution_date, Transaction.amount, Transaction.description).filter(Transaction.amount < 0).all()
    if not tx_list:
        return []
        
    df = pd.DataFrame([{"date": t.execution_date, "amount": float(t.amount), "desc": t.description} for t in tx_list if t.description])
    if df.empty:
        return []
        
    df['month'] = df['date'].dt.to_period('M')
    monthly = df.groupby(['desc', 'month'])['amount'].sum().reset_index()
    
    sub_candidates = monthly.groupby('desc').agg(
        months_count=('month', 'nunique'),
        avg_amount=('amount', 'mean')
    ).reset_index()
    
    subs = sub_candidates[sub_candidates['months_count'] >= 2]
    
    result = []
    for _, row in subs.iterrows():
        desc = row['desc']
        desc_txs = df[df['desc'] == desc].sort_values('date', ascending=False)
        latest_amt = desc_txs.iloc[0]['amount']
        latest_date = desc_txs.iloc[0]['date']
        
        result.append({
            "name": desc,
            "months_active": int(row['months_count']),
            "average_amount": abs(float(row['avg_amount'])),
            "latest_amount": abs(float(latest_amt)),
            "last_date": latest_date.strftime('%Y-%m-%d')
        })
    
    return sorted(result, key=lambda x: x['latest_amount'], reverse=True)

