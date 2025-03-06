# app/models/user_file.py
from app import db
from datetime import datetime

class UserFile(db.Model):
    __tablename__ = 'user_files'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('file_templates.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_url = db.Column(db.String(255))
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    
    # 关系
    # 移除 template 关系，因为在 FileTemplate 中已经定义了 submissions 反向关系

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'file_url': self.file_url,
            'upload_date': self.upload_date.isoformat(),
            'status': self.status
        }