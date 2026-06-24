from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    two_factor_secret = Column(String, nullable=True)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)

class Inbound(Base):
    __tablename__ = "inbounds"
    
    id = Column(Integer, primary_key=True, index=True)
    remark = Column(String, nullable=True)
    protocol = Column(String, nullable=False)
    port = Column(Integer, unique=True, nullable=False, index=True)
    settings = Column(String, nullable=True)          # JSON string
    stream_settings = Column(String, nullable=True)   # JSON string
    enable = Column(Boolean, default=True, nullable=False)
    up = Column(BigInteger, default=0, nullable=False)
    down = Column(BigInteger, default=0, nullable=False)
    total = Column(BigInteger, default=0, nullable=False)
    expiry_time = Column(BigInteger, default=0, nullable=False)
    network = Column(String, default="ws", nullable=False)
    security = Column(String, default="tls", nullable=False)
    sni = Column(String, nullable=True)
    ws_path = Column(String, default="/", nullable=True)
    ws_host = Column(String, nullable=True)
    sniffing_enabled = Column(Boolean, default=True, nullable=False)
    grpc_service_name = Column(String, nullable=True)
    
    # Relationship to clients
    clients = relationship("Client", back_populates="inbound", cascade="all, delete-orphan")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, index=True)
    inbound_id = Column(Integer, ForeignKey("inbounds.id"), nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    uuid = Column(String, nullable=False)
    total_gb = Column(Float, default=0.0, nullable=False)
    expiry_time = Column(BigInteger, default=0, nullable=False)
    up = Column(BigInteger, default=0, nullable=False)
    down = Column(BigInteger, default=0, nullable=False)
    enable = Column(Boolean, default=True, nullable=False)
    limit_ip = Column(Integer, default=0, nullable=False)
    tg_id = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    flow = Column(String, nullable=True)
    
    # Relationship to inbound
    inbound = relationship("Inbound", back_populates="clients")

class APIToken(Base):
    __tablename__ = "api_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    scope = Column(String, default="read_only", nullable=False) # read_only, client_manage, full_access
    created_at = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=True)

