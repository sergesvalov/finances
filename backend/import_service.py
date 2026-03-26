import pandas as pd
import hashlib
from io import BytesIO
from sqlalchemy.orm import Session
from datetime import datetime
from models import Transaction, Category

def generate_hash(date_str: str, amount: str, description: str) -> str:
    hash_str = f"{date_str}_{amount}_{description}"
    return hashlib.sha256(hash_str.encode('utf-8')).hexdigest()

def guess_category(description: str, db: Session) -> int | None:
    # A simple rule-based categorization
    desc_lower = str(description).lower()
    rules = {
        "супермаркеты": ["supermarket", "grocery", "lidl", "maxima", "rimi", "iki", "iki", "магазин"],
        "кафе/пекарни": ["bakery", "cafe", "coffee", "restaurant", "mcdonalds", "kfc", "wolt", "bolt food"],
        "транспорт": ["uber", "bolt", "taxi", "transport", "bus", "train", "parking", "m.ticket", "trafik", "kautra", "ltg"],
        "аптеки": ["pharmacy", "apotheke", "vaistine", "eurovaistine", "camelia", "benu"],
        "развлечения": ["cinema", "netflix", "spotify", "steam", "playstation", "xbox", "game"],
        "подписки": ["google", "apple", "amazon", "microsoft", "patreon", "youtube", "chatgpt", "openai", "midjourney"]
    }
    
    for category_name, keywords in rules.items():
        if any(keyword in desc_lower for keyword in keywords):
            # Check if category exists
            category = db.query(Category).filter(Category.name == category_name).first()
            if not category:
                category = Category(name=category_name)
                db.add(category)
                db.commit()
                db.refresh(category)
            return category.id
            
    return None

def process_csv_import(file_contents: bytes, db: Session) -> dict:
    try:
        # Revolut typically uses utf-8 and comma separator
        df = pd.read_csv(BytesIO(file_contents))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed to parse CSV", exc_info=True)
        return {"error": f"Failed to parse CSV: {str(e)}"}
    
    # Check if necessary columns exist
    required_cols = {"Дата выполнения", "Описание", "Сумма", "Валюта", "Остаток средств", "State"}
    if not required_cols.issubset(set(df.columns)):
        return {"error": f"Missing required columns. Found: {list(df.columns)}"}
        
    imported_count = 0
    skipped_count = 0
    
    # Filter only COMPLETED or relevant states, skip pending if necessary
    # Revolut 'State' might be 'COMPLETED', 'PENDING', 'REVERTED'
    if 'State' in df.columns:
         df = df[df['State'] == 'COMPLETED']
         
    for _, row in df.iterrows():
        try:
             date_str = str(row['Дата выполнения'])
             amount = float(row['Сумма'])
             description = str(row['Описание'])
             currency = str(row['Валюта'])
             # Sometimes balance is missing or NaN
             balance = float(row['Остаток средств']) if pd.notna(row['Остаток средств']) else 0.0
             
             # Parse date
             parsed_date = pd.to_datetime(date_str).to_pydatetime()
             
             tx_hash = generate_hash(date_str, str(amount), description)
             
             # Check if exists
             existing = db.query(Transaction).filter(Transaction.original_hash == tx_hash).first()
             if existing:
                 skipped_count += 1
                 continue
                 
             # Assign category
             cat_id = guess_category(description, db)
             
             tx = Transaction(
                 execution_date=parsed_date,
                 amount=amount,
                 description=description,
                 currency=currency,
                 balance=balance,
                 original_hash=tx_hash,
                 category_id=cat_id
             )
             db.add(tx)
             imported_count += 1
             
        except Exception as e:
             # Skip row if invalid data
             import logging
             logging.getLogger(__name__).warning(f"Error skipping row: {e}", exc_info=True)
             skipped_count += 1
             continue
             
    db.commit()
    return {"imported": imported_count, "skipped": skipped_count}
