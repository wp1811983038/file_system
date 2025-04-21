# app/models/feedback.py
from app import db
from datetime import datetime

class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # 问题类型
    content = db.Column(db.Text, nullable=False)  # 问题描述
    contact_info = db.Column(db.String(100))  # 联系方式
    status = db.Column(db.String(20), default='pending')  # pending, processing, resolved
    admin_comment = db.Column(db.Text)  # 管理员回复
    image_urls = db.Column(db.Text)  # 存储图片URL，用逗号分隔
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联
    user = db.relationship('User', backref=db.backref('feedbacks', lazy='dynamic'))
    
    def to_dict(self):
        """转换为字典，用于API响应"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.username if self.user else None,
            'type': self.type,
            'content': self.content,
            'contact_info': self.contact_info,
            'status': self.status,
            'admin_comment': self.admin_comment,
            'image_urls': self.image_urls.split(',') if self.image_urls else [],
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        }