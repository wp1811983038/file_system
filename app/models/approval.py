from app import db
from datetime import datetime

class ApprovalWorkflow(db.Model):
    __tablename__ = 'approval_workflows'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class WorkflowStep(db.Model):
    __tablename__ = 'workflow_steps'
    
    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('approval_workflows.id'), nullable=False)
    step_order = db.Column(db.Integer, nullable=False)
    approver_type = db.Column(db.Enum('role', 'user'), nullable=False)
    approver_id = db.Column(db.Integer)  # 如果是user类型则指向用户id
    role = db.Column(db.String(50))      # 如果是role类型则指定角色
    
    workflow = db.relationship('ApprovalWorkflow', backref=db.backref('steps', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'step_order': self.step_order,
            'approver_type': self.approver_type,
            'approver_id': self.approver_id,
            'role': self.role
        }

class FileApproval(db.Model):
    __tablename__ = 'file_approvals'
    
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('user_files.id'), nullable=False)
    approver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.Enum('pending', 'approved', 'rejected'), default='pending', nullable=False)
    comments = db.Column(db.Text)
    approval_date = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    file = db.relationship('UserFile', backref=db.backref('approvals', lazy='dynamic'))
    approver = db.relationship('User', backref=db.backref('approvals', lazy='dynamic'))
    
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