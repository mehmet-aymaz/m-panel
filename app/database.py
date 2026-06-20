import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////opt/m-panel/app/data/panel.db")

# Extract the file path if it is sqlite and ensure parent directory exists
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    # Remove leading slashes if they are redundant, but keep absolute paths
    if db_path.startswith("//"):
        db_path = db_path[2:]
    dir_path = os.path.dirname(db_path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
