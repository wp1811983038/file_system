# app/models/inspection.py
from app import db
from datetime import datetime

class Inspection(db.Model):
    __tablename__ = 'inspections'
    
    id = db.Column(db.Integer, primary_key=True)
    enforcer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    inspection_type = db.Column(db.String(50), nullable=False)
    planned_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text)
    basis = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending')  # pending, completed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # 关联关系
    enforcer = db.relationship('User', foreign_keys=[enforcer_id], backref=db.backref('inspections_created', lazy='dynamic'))
    company = db.relationship('User', foreign_keys=[company_id], backref=db.backref('inspections_received', lazy='dynamic'))
    problems = db.relationship('InspectionProblem', backref='inspection', lazy='dynamic', cascade='all, delete-orphan')
    photos = db.relationship('InspectionPhoto', backref='inspection', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'enforcer_id': self.enforcer_id,
            'company_id': self.company_id,
            'company_name': self.company.company_name,
            'inspection_type': self.inspection_type,
            'planned_date': self.planned_date.strftime('%Y-%m-%d') if self.planned_date else None,
            'description': self.description,
            'basis': self.basis,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'completed_at': self.completed_at.strftime('%Y-%m-%d %H:%M:%S') if self.completed_at else None,
            'problem_count': self.problems.count(),
            'photo_count': self.photos.count()
        }