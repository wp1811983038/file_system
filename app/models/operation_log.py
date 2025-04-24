# app/models/operation_log.py
from app import db
from datetime import datetime

class OperationLog(db.Model):
    __tablename__ = 'operation_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False, comment='操作类型：system_notice, template, submission, approval, inspection, feedback')
    operator_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    target_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    content = db.Column(db.Text, nullable=False, comment='操作内容')
    status = db.Column(db.String(20), default='success', comment='操作状态：success, pending, rejected, processing')
    remarks = db.Column(db.Text, comment='备注')
    related_id = db.Column(db.Integer, comment='关联ID')
    related_type = db.Column(db.String(50), comment='关联类型')
    operate_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    operator = db.relationship('User', foreign_keys=[operator_id], backref=db.backref('operation_logs', lazy='dynamic'))
    target_user = db.relationship('User', foreign_keys=[target_user_id], backref=db.backref('related_operation_logs', lazy='dynamic'))
    
    def to_dict(self, include_users=False):
        result = {
            'id': self.id,
            'type': self.type,
            'content': self.content,
            'status': self.status,
            'remarks': self.remarks,
            'related_id': self.related_id,
            'related_type': self.related_type,
            'operate_time': self.operate_time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        if include_users:
            # 添加操作人信息
            if self.operator:
                result['operator'] = {
                    'id': self.operator.id,
                    'username': self.operator.username,
                    'company_name': self.operator.company_name,
                    'contact_info': self.operator.contact_info
                }
            else:
                result['operator'] = None
                
            # 添加目标用户信息
            if self.target_user:
                result['target_user'] = {
                    'id': self.target_user.id,
                    'username': self.target_user.username,
                    'company_name': self.target_user.company_name,
                    'contact_info': self.target_user.contact_info
                }
            else:
                result['target_user'] = None
        else:
            # 仅包含基本用户信息
            result['operator_id'] = self.operator_id
            result['operator_name'] = self.operator.username if self.operator else None
            result['target_user_id'] = self.target_user_id
            result['target_user_name'] = self.target_user.username if self.target_user else None
            
        return result