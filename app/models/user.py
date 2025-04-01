# app/models/user.py
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
import jwt
from datetime import datetime, timedelta
from config import Config


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    openid = db.Column(db.String(100))  # 微信用户的唯一标识
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    company_name = db.Column(db.String(100))
    contact_info = db.Column(db.String(100), unique=True)  # 修改为唯一
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 新增字段
    company_address = db.Column(db.Text, comment='企业地址')
    industry = db.Column(db.String(50), comment='所属行业')
    recruitment_unit = db.Column(db.String(50), comment='招商单位')
    
    # 关系
    files = db.relationship('UserFile', backref='user', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """验证密码"""
        print(f"Checking password for user {self.username}")
        print(f"Stored password hash: {self.password_hash}")
        result = check_password_hash(self.password_hash, password)
        print(f"Password check result: {result}")
        return result

    def generate_token(self):
        return jwt.encode(
            {
                'user_id': self.id,
                'exp': datetime.utcnow() + timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)
            },
            Config.SECRET_KEY,
            algorithm='HS256'
        )
        
    def to_dict(self):
        """转换为字典，用于API响应"""
        return {
            'id': self.id,
            'username': self.username,
            'company_name': self.company_name,
            'contact_info': self.contact_info,
            'company_address': self.company_address,
            'industry': self.industry,
            'recruitment_unit': self.recruitment_unit,
            'is_admin': self.is_admin,
            'avatar_url': self.avatar_url,  # 添加头像URL
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
    @staticmethod
    def from_dict(data):
        """从字典创建用户实例，用于数据导入"""
        user = User()
        for field in ['username', 'company_name', 'contact_info', 
                     'company_address', 'industry', 'recruitment_unit', 'is_admin']:
            if field in data:
                setattr(user, field, data[field])
        
        if 'password' in data:
            user.set_password(data['password'])
            
        return user