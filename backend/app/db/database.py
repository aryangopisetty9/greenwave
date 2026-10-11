from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from fastapi import HTTPException, status
from app.core.config import settings

def create_db_engine():
    if not settings.SQLALCHEMY_DATABASE_URI:
        return None
        
    is_sqlite = "sqlite" in settings.SQLALCHEMY_DATABASE_URI
    if is_sqlite:
        return create_engine(
            settings.SQLALCHEMY_DATABASE_URI,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False}
        )
    else:
        # Neon PostgreSQL Serverless connection configuration
        # pool_pre_ping ensures stale pooled connections are tested before use
        # pool_recycle refreshes connections to prevent PgBouncer timeouts
        return create_engine(
            settings.SQLALCHEMY_DATABASE_URI,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=5,
            max_overflow=10
        )

engine = create_db_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None

Base = declarative_base()

def get_db():
    if settings.DATABASE_CONFIG_ERROR or not settings.SQLALCHEMY_DATABASE_URI or SessionLocal is None:
        error_msg = settings.DATABASE_CONFIG_ERROR or (
            "Database service unavailable: PostgreSQL connection string is not configured. "
            "Please configure POSTGRES_URL in Vercel settings."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error_msg
        )
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
