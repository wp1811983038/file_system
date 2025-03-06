# app/models/settings.py
from app import db

class Settings(db.Model):
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    system_name = db.Column(db.String(100), default='文件管理系统')
    system_description = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'system_name': self.system_name,
            'system_description': self.system_description
        }