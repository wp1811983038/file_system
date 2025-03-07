# app/models/file_approval.py
from app import db
from datetime import datetime

class FileApproval(db.Model):
    __tablename__ = 'file_approvals'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('user_files.id'), nullable=False)
    approver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.Enum('pending', 'approved', 'rejected'), default='pending', nullable=False)
    comments = db.Column(db.Text)
    approval_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    file = db.relationship('UserFile', backref='approvals')
    approver = db.relationship('User', backref='file_approvals')
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'approver_id': self.approver_id,
            'approver_name': self.approver.username if self.approver else None,
            'status': self.status,
            'comments': self.comments,
            'approval_date': self.approval_date.strftime('%Y-%m-%d %H:%M:%S') if self.approval_date else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }