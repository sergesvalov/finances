import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from database import SessionLocal
from models import Category, CategoryGroup
db = SessionLocal()
for c in db.query(Category).all():
    gname = c.group.name if c.group else ""
    print(f"Cat: {c.name}, Group: {gname}")
