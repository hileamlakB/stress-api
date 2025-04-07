import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON, Float
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
    email = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"

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
    
    # Relationships
    session = relationship("Session", back_populates="configurations")
    test_results = relationship("TestResult", back_populates="configuration", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SessionConfiguration(id={self.id}, session_id={self.session_id}, endpoint_url={self.endpoint_url})>"

class TestResult(Base):
    __tablename__ = 'test_results'

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    configuration_id = Column(GUID(), ForeignKey('session_configurations.id'), nullable=False)
    test_id = Column(String, nullable=False)  # The ID assigned to the test run
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String, nullable=False)  # pending, running, completed, failed, stopped
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_response_time = Column(Float, nullable=True)
    min_response_time = Column(Float, nullable=True)
    max_response_time = Column(Float, nullable=True)
    status_codes = Column(JSON, nullable=True)  # Count of each status code
    results_data = Column(JSON, nullable=True)  # Detailed test results
    summary = Column(JSON, nullable=True)  # Summary statistics
    
    # Relationship
    configuration = relationship("SessionConfiguration", back_populates="test_results")

    def __repr__(self):
        return f"<TestResult(id={self.id}, test_id={self.test_id}, status={self.status})>"
