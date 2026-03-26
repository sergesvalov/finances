from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import import_service

router = APIRouter(prefix="/api/import", tags=["Import"])

@router.post("")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file format. Upload a CSV.")
        
    contents = await file.read()
    
    result = import_service.process_csv_import(contents, db)
    
    if "error" in result:
        import logging
        logging.getLogger(__name__).error(f"Import returned error: {result['error']}")
        raise HTTPException(status_code=400, detail=result["error"])
        
    return {
        "message": "Import successful",
        "imported_rows": result.get("imported", 0),
        "skipped_rows": result.get("skipped", 0)
    }
