# app/models/wx_subscription.py
from app import db
from datetime import datetime

class WxSubscription(db.Model):
    __tablename__ = 'wx_subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    openid = db.Column(db.String(100), nullable=False)
    file_receive_status = db.Column(db.String(20), default='reject')
    file_process_status = db.Column(db.String(20), default='reject')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联到用户
    user = db.relationship('User', backref=db.backref('wx_subscription', uselist=False))