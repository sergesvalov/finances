from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import TelegramRecipient
from pydantic import BaseModel

router = APIRouter(prefix="/api/recipients", tags=["Recipients"])

class RecipientCreate(BaseModel):
    telegram_id: str
    name: str

@router.get("")
def get_recipients(db: Session = Depends(get_db)):
    recipients = db.query(TelegramRecipient).all()
    return [{"id": r.id, "telegram_id": r.telegram_id, "name": r.name} for r in recipients]

@router.post("")
def add_recipient(recipient: RecipientCreate, db: Session = Depends(get_db)):
    existing = db.query(TelegramRecipient).filter(TelegramRecipient.telegram_id == recipient.telegram_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recipient with this Telegram ID already exists")
    
    new_rec = TelegramRecipient(telegram_id=recipient.telegram_id, name=recipient.name)
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)
    return {"id": new_rec.id, "telegram_id": new_rec.telegram_id, "name": new_rec.name}

@router.delete("/{recipient_id}")
def remove_recipient(recipient_id: int, db: Session = Depends(get_db)):
    rec = db.query(TelegramRecipient).filter(TelegramRecipient.id == recipient_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    db.delete(rec)
    db.commit()
    return {"message": "Recipient removed successfully"}
