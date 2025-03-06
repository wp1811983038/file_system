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
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    company_name = db.Column(db.String(100))
    contact_info = db.Column(db.String(100))
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
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