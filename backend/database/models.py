import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, TEXT

Base = declarative_base()

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses SQLite's TEXT type, storing as string.
    """
    impl = TEXT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        elif isinstance(value, str):
            return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        else:
            return uuid.UUID(value)

class User(Base):
    __tablename__ = 'users'

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    username = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email})>"

class Session(Base):
    __tablename__ = 'sessions'

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    configurations = relationship("SessionConfiguration", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session(id={self.id}, name={self.name}, user_id={self.user_id})>"

class SessionConfiguration(Base):
    __tablename__ = 'session_configurations'

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(GUID(), ForeignKey('sessions.id'), nullable=False)
    endpoint_url = Column(String, nullable=False)
    http_method = Column(String, nullable=False)  # GET, POST, PUT, DELETE
    request_headers = Column(JSON, nullable=True)
    request_body = Column(JSON, nullable=True)
    request_params = Column(JSON, nullable=True)
    concurrent_users = Column(Integer, nullable=False)
    ramp_up_time = Column(Integer, nullable=False)  # seconds
    test_duration = Column(Integer, nullable=False)  # seconds
    think_time = Column(Integer, nullable=False)  # seconds
    success_criteria = Column(JSON, nullable=True)
    
    # Relationship
    session = relationship("Session", back_populates="configurations")

    def __repr__(self):
        return f"<SessionConfiguration(id={self.id}, session_id={self.session_id}, endpoint_url={self.endpoint_url})>"
