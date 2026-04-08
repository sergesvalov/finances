import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import ReceiptUpload

router = APIRouter(prefix="/api/receipt-uploads", tags=["ReceiptUploads"])

RECEIPTS_INBOX = "/app/receipts/inbox"


def _session_dict(session_id: str, items: list) -> dict:
    return {
        "session_id": session_id,
        "uploaded_at": items[0].uploaded_at.isoformat(),
        "count": len(items),
        "telegram_chat_id": items[0].telegram_chat_id,
        "files": [
            {
                "id": item.id,
                "filename": item.filename,
                "url": f"/receipts/inbox/{session_id}/{item.filename}",
                "original_filename": item.original_filename,
                "uploaded_at": item.uploaded_at.isoformat(),
            }
            for item in items
        ],
    }


@router.get("", response_model=list)
def list_sessions(db: Session = Depends(get_db)):
    """Return all upload sessions grouped by session_id, newest first."""
    uploads = (
        db.query(ReceiptUpload)
        .order_by(ReceiptUpload.uploaded_at.desc())
        .all()
    )

    # Group by session_id, preserve order (first seen = most recent because DESC)
    sessions: dict[str, list] = {}
    for u in uploads:
        sessions.setdefault(u.session_id, []).append(u)

    return [_session_dict(sid, items) for sid, items in sessions.items()]


@router.get("/{session_id}", response_model=dict)
def get_session(session_id: str, db: Session = Depends(get_db)):
    items = (
        db.query(ReceiptUpload)
        .filter(ReceiptUpload.session_id == session_id)
        .order_by(ReceiptUpload.uploaded_at)
        .all()
    )
    if not items:
        raise HTTPException(status_code=404, detail="Session not found")
    return _session_dict(session_id, items)


@router.delete("/{session_id}", response_model=dict)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    items = db.query(ReceiptUpload).filter(ReceiptUpload.session_id == session_id).all()
    if not items:
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete files from disk
    folder = os.path.join(RECEIPTS_INBOX, session_id)
    if os.path.isdir(folder):
        shutil.rmtree(folder)

    db.query(ReceiptUpload).filter(ReceiptUpload.session_id == session_id).delete()
    db.commit()
    return {"message": f"Deleted session {session_id} with {len(items)} files"}


@router.delete("/item/{item_id}", response_model=dict)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ReceiptUpload).filter(ReceiptUpload.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Receipt not found")

    file_path = os.path.join(RECEIPTS_INBOX, item.session_id, item.filename)
    if os.path.isfile(file_path):
        os.remove(file_path)

    db.delete(item)
    db.commit()
    return {"message": "Receipt deleted"}
