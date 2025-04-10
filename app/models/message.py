# app/models/message.py
from app import db
from datetime import datetime

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    # 消息类型与微信订阅消息类型对齐
   # 消息类型与微信订阅消息类型对齐
    # 消息类型与微信订阅消息类型对齐
    # 消息类型
    type = db.Column(db.String(20), default='system', 
                    comment='消息类型: system-系统通知, file_receive-文件接收, file_process-文件处理, inspection_notice-执法检查')
    # 关联ID - 可能是文件ID或模板ID
    related_id = db.Column(db.Integer, nullable=True)
    related_type = db.Column(db.String(20), nullable=True, 
                           comment='关联类型: user_file, file_template')
    # 消息状态: unread-未读, read-已读
    status = db.Column(db.String(10), default='unread')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联
    user = db.relationship('User', backref=db.backref('messages', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'type': self.type,
            'related_id': self.related_id,
            'related_type': self.related_type,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }