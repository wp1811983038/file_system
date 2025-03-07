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
    # 状态可以是: pending(待审批), approved(已批准), rejected(已拒绝)
    status = db.Column(db.String(20), default='pending', nullable=False)
    # 删除update_time字段，因为数据库中实际没有这个字段
    
    # 删除所有关系定义，因为它们已经在其他模型中定义了
    
    def to_dict(self):
        from app.models.user import User
        from app.models.file_template import FileTemplate
        
        # 通过查询获取用户和模板信息
        user = User.query.get(self.user_id)
        template = FileTemplate.query.get(self.template_id)
        
        return {
            'id': self.id,
            'user_id': self.user_id,
            'template_id': self.template_id,
            'filename': self.filename,
            'file_url': self.file_url,
            'upload_date': self.upload_date.strftime('%Y-%m-%d %H:%M:%S') if self.upload_date else None,
            'status': self.status,
            'user': {
                'id': user.id,
                'username': user.username,
                'company_name': user.company_name
            } if user else None,
            'template': {
                'id': template.id,
                'name': template.name
            } if template else None
        }