from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Setting
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SettingsUpdate(BaseModel):
    telegram_bot_token: str = ""

@router.get("", response_model=SettingsUpdate)
def get_settings(db: Session = Depends(get_db)):
    token_setting = db.query(Setting).filter(Setting.key == "telegram_bot_token").first()
    return SettingsUpdate(telegram_bot_token=token_setting.value if token_setting else "")

@router.post("")
def update_settings(settings: SettingsUpdate, db: Session = Depends(get_db)):
    token_setting = db.query(Setting).filter(Setting.key == "telegram_bot_token").first()
    if not token_setting:
        token_setting = Setting(key="telegram_bot_token", value=settings.telegram_bot_token)
        db.add(token_setting)
    else:
        token_setting.value = settings.telegram_bot_token
    db.commit()
    return {"message": "Settings updated successfully"}
