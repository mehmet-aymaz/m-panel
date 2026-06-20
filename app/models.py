from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

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
