from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String)
    contact_number = Column(String)
    instagram_handle = Column(String)
    acquisition_source = Column(String)
    is_first_time = Column(String)
    registration_date = Column(DateTime)
    consent = Column(String)
    package = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    bookings = relationship("Booking", back_populates="customer")


class Package(Base):
    __tablename__ = "packages"

    package_id = Column(Integer, primary_key=True, index=True)
    category = Column(String)
    name = Column(String)
    base_price = Column(Float)
    duration = Column(Integer)
    max_people = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Addon(Base):
    __tablename__ = "addons"

    addon_id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    category = Column(String)
    price = Column(Float)
    applies_to = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Booking(Base):
    __tablename__ = "bookings"

    booking_id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"))
    package_id = Column(Integer, ForeignKey("packages.package_id"))
    booking_date = Column(DateTime)
    session_date = Column(DateTime)
    base_price = Column(Float)
    gcash_payment = Column(Float)
    cash_payment = Column(Float)
    session_status = Column(String)
    created_at = Column(DateTime, default=datetime.now)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    customer = relationship("Customer", back_populates="bookings")


class BookingAddon(Base):
    __tablename__ = "booking_addons"

    booking_id = Column(Integer, ForeignKey("bookings.booking_id"), primary_key=True)
    addon_id = Column(Integer, ForeignKey("addons.addon_id"), primary_key=True)
    addon_quantity = Column(Integer)
    addon_price = Column(Float)
    total_addon_cost = Column(Float)
    created_at = Column(DateTime, default=datetime.now)
    last_updated = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Renewal(Base):
    __tablename__ = "renewals"

    customer_id = Column(Integer, ForeignKey("customers.customer_id"), primary_key=True)
    total_bookings = Column(Integer)
    avg_booking_value = Column(Float)
    booking_frequency = Column(Float)
    renewed_within_365 = Column(Boolean)
