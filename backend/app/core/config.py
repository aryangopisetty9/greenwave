import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "GreenWave API"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development" # "development", "production", "test"
    
    # Security
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175", 
        "http://localhost:3000",
        "https://greenwave-blush.vercel.app"
    ]
    
    # Database configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "greenwave"
    POSTGRES_URL: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    DATABASE_CONFIG_ERROR: Optional[str] = None
    
    # Traffic Provider (e.g., TomTom)
    TRAFFIC_PROVIDER: str = "tomtom"
    TRAFFIC_API_KEY: str = ""
    
    # Simulation
    SIMULATION_ENGINE: str = "fallback" # or "sumo"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Check if running in production or Vercel
        is_production = (
            os.environ.get("VERCEL") == "1" or 
            os.environ.get("ENVIRONMENT", "").lower() == "production" or 
            self.ENVIRONMENT == "production"
        )
        
        # Priority check for PostgreSQL connection variables
        raw_db_uri = (
            os.environ.get("POSTGRES_URL") or 
            os.environ.get("DATABASE_URL") or 
            os.environ.get("SQLALCHEMY_DATABASE_URI") or 
            self.POSTGRES_URL or 
            self.DATABASE_URL or 
            self.SQLALCHEMY_DATABASE_URI
        )
        
        if raw_db_uri and ("postgres" in raw_db_uri.lower() or "sqlite" in raw_db_uri.lower()):
            db_uri = raw_db_uri.strip().strip("'").strip('"')
            # Normalize PostgreSQL scheme for psycopg3 driver
            if db_uri.startswith("postgres://"):
                db_uri = db_uri.replace("postgres://", "postgresql+psycopg://", 1)
            elif db_uri.startswith("postgresql://") and not db_uri.startswith("postgresql+"):
                db_uri = db_uri.replace("postgresql://", "postgresql+psycopg://", 1)
            
            # Check if production was accidentally configured with local SQLite
            if is_production and "sqlite" in db_uri.lower():
                self.SQLALCHEMY_DATABASE_URI = None
                self.DATABASE_CONFIG_ERROR = (
                    "Production database is not configured with persistent PostgreSQL. "
                    "Please set POSTGRES_URL or DATABASE_URL in Vercel project environment variables."
                )
            else:
                self.SQLALCHEMY_DATABASE_URI = db_uri
                self.DATABASE_CONFIG_ERROR = None
        else:
            if is_production:
                # Do NOT silently fall back to /tmp or in-memory SQLite in production
                self.SQLALCHEMY_DATABASE_URI = None
                self.DATABASE_CONFIG_ERROR = (
                    "Production database is not configured. "
                    "Please set POSTGRES_URL or DATABASE_URL in Vercel project environment variables."
                )
            else:
                # Local development default: project SQLite database
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                db_path = os.path.join(base_dir, "greenwave.db")
                self.SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
                self.DATABASE_CONFIG_ERROR = None

    def validate_production_config(self):
        """Validate production configuration. Raises ValueError if database is improperly configured."""
        if self.DATABASE_CONFIG_ERROR:
            raise ValueError(self.DATABASE_CONFIG_ERROR)
        return True

settings = Settings()
