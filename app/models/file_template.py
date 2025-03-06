# app/models/file_template.py
from app import db
from datetime import datetime
from flask import url_for
import os

class FileTemplate(db.Model):
    __tablename__ = 'file_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    filename = db.Column(db.String(255))
    file_path = db.Column(db.String(255))
    file_url = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 修改关系，添加级联删除
    submissions = db.relationship('UserFile', backref='template', 
                                lazy='select',
                                cascade='all, delete-orphan')  # 添加这个配置

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'filename': self.filename,
            'download_url': self.file_url,
            'created_at': self.created_at.isoformat(),
            'file_size': self.get_file_size()
        }

    def get_file_size(self):
        """获取文件大小"""
        if self.file_path and os.path.exists(self.file_path):
            return os.path.getsize(self.file_path)
        return 0