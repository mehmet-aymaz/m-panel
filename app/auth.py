import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from database import get_db
import models
from dotenv import load_dotenv

# Path to .env file
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

# Create .env if it doesn't exist
if not os.path.exists(ENV_FILE):
    with open(ENV_FILE, "w") as f:
        f.write("# M-Panel Environment Variables\n")

# Load existing environment variables
load_dotenv(ENV_FILE)

import bcrypt

# Retrieve or generate JWT_SECRET_KEY
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = secrets.token_hex(32)
    with open(ENV_FILE, "a") as f:
        f.write(f"\nJWT_SECRET_KEY={JWT_SECRET_KEY}\n")
    # Reload environment variables
    load_dotenv(ENV_FILE)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.AdminUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # 1. Try decoding as JWT
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is not None:
            user = db.query(models.AdminUser).filter(models.AdminUser.username == username).first()
            if user is not None:
                return user
    except JWTError:
        pass
        
    # 2. Try matching as API Token
    api_token = db.query(models.APIToken).filter(models.APIToken.token == token, models.APIToken.is_active == True).first()
    if api_token is not None:
        # Check permissions based on scope
        method = request.method
        path = request.url.path
        scope = api_token.scope
        
        # Enforce scope restrictions
        if scope == "read_only":
            if method != "GET":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu işlem için yetkiniz bulunmamaktadır (Salt Okunur)"
                )
        elif scope == "client_manage":
            # Allow all GET requests
            # For write requests, only allow client endpoints
            if method in ["POST", "PUT", "DELETE"]:
                # Strip /api prefix if present for uniform check
                clean_path = path[4:] if path.startswith("/api") else path
                is_client_path = clean_path.startswith("/clients") or clean_path.startswith("clients")
                if not is_client_path:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Bu işlem için yetkiniz bulunmamaktadır (Sadece Kullanıcı Yönetimi)"
                    )
        elif scope == "full_access":
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Geçersiz yetki kapsamı (Scope)"
            )
            
        # Get the first admin user since M-Panel currently only has one admin
        admin = db.query(models.AdminUser).first()
        if admin is not None:
            return admin
            
    raise credentials_exception
