from functools import wraps
from flask import request, jsonify,g
from app.models.user import User
from app import db
import jwt
from flask import current_app

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # 从Cookie获取token
        if 'token' in request.cookies:
            token = request.cookies.get('token')
        
        # 从Header获取token（兼容小程序）
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            token = auth_header.split(" ")[1] if len(auth_header.split(" ")) > 1 else None
            
        if not token:
            return jsonify({'error': '需要认证'}), 401
            
        try:
            # 解码token
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            # 使用 Session.get() 替代 Query.get()
            current_user = db.session.get(User, data['user_id'])
            if not current_user:
                return jsonify({'error': '用户不存在'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'token已过期'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': '无效的token'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not args or not args[0].is_admin:
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated 



def enforcer_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'current_user') or not g.current_user.is_enforcer:
            return jsonify({'error': '只有执法人员才能访问此资源'}), 403
        return f(*args, **kwargs)
    return decorated