# app/utils/auth.py
from functools import wraps
from flask import request, jsonify, g
import jwt
from app import db
from app.models.user import User
from config import Config

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # 从header中获取token
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': '需要认证'}), 401
            
        try:
            # 解析token
            payload = jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])
            user_id = payload['user_id']
            
            # 获取用户信息
            current_user = User.query.get(user_id)
            if not current_user:
                return jsonify({'error': '用户不存在'}), 401
                
            # 将用户信息存储在g对象中，以便其他函数使用
            g.current_user = current_user
            
            return f(current_user, *args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': '令牌已过期'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': '无效的令牌'}), 401
            
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': '需要管理员权限'}), 403
            
        return f(current_user, *args, **kwargs)
    
    return decorated

def enforcer_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        # 直接使用传入的current_user参数，不从g对象中获取
        if current_user.role != 'enforcer':
            return jsonify({'error': '需要执法人员权限'}), 403
            
        return f(current_user, *args, **kwargs)
    
    return decorated