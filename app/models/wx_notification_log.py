# app/models/wx_notification_log.py
from app import db
from datetime import datetime

class WxNotificationLog(db.Model):
    __tablename__ = 'wx_notification_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    template_id = db.Column(db.String(100), nullable=False)
    openid = db.Column(db.String(100), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('user_files.id', ondelete='SET NULL'), nullable=True)
    notification_type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')
    error_msg = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联
    user = db.relationship('User', backref=db.backref('notification_logs', lazy='dynamic'))
    file = db.relationship('UserFile', backref=db.backref('notification_logs', lazy='dynamic'))