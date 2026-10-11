from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "GreenWave API"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"]
    
    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "greenwave"
    POSTGRES_URL: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    
    # Traffic Provider (e.g., TomTom)
    TRAFFIC_PROVIDER: str = "tomtom"
    TRAFFIC_API_KEY: str = ""
    
    # Simulation
    SIMULATION_ENGINE: str = "fallback" # or "sumo"
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Check standard hosted database environment variables
        db_uri = self.SQLALCHEMY_DATABASE_URI or self.POSTGRES_URL or self.DATABASE_URL
        if db_uri:
            # Normalize postgres:// and postgresql:// to postgresql+psycopg://
            if db_uri.startswith("postgres://"):
                db_uri = db_uri.replace("postgres://", "postgresql+psycopg://", 1)
            elif db_uri.startswith("postgresql://") and not db_uri.startswith("postgresql+"):
                db_uri = db_uri.replace("postgresql://", "postgresql+psycopg://", 1)
            self.SQLALCHEMY_DATABASE_URI = db_uri
        elif not self.SQLALCHEMY_DATABASE_URI:
            self.SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

settings = Settings()
