import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, system, dashboard, inbounds, clients, public

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="M-Panel API Backend",
    description="FastAPI Backend for M-Panel Xray VPN Management",
    version="1.0.0"
)

# CORS Configuration
origins = [
    "https://panel.mehmetaymaz.com.tr",
    "http://panel.mehmetaymaz.com.tr",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root/Health Check Endpoint
@app.get("/health")
def health_check():
    xray_active = False
    try:
        res = subprocess.run(["systemctl", "is-active", "xray"], capture_output=True, text=True)
        xray_active = res.stdout.strip() == "active"
    except Exception:
        pass
        
    return {
        "status": "ok",
        "xray_active": xray_active
    }

# Include Routers
app.include_router(public.router)
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(dashboard.router)
app.include_router(inbounds.router)
app.include_router(clients.router)
