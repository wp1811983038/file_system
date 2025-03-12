from flask import request, jsonify
from app.models.user import User
from app import db
from app.utils.auth import token_required
from . import bp_auth as bp
import jwt
from datetime import datetime, timedelta
from config import Config

@bp.route('/login', methods=['POST', 'GET'])
def login():
    if request.method == 'GET':
        return jsonify({'status': 'login page'}), 200
    
    data = request.get_json()
    login_id = data.get('login_id')  # 使用login_id作为统一字段，可以是用户名或手机号
    password = data.get('password')
    
    if not login_id or not password:
        return jsonify({'error': '账号和密码不能为空'}), 400
    
    # 先尝试使用用户名查找用户
    user = User.query.filter_by(username=login_id).first()
    
    # 如果找不到，再尝试使用手机号查找
    if not user:
        user = User.query.filter_by(contact_info=login_id).first()
    
    # 验证密码
    if not user or not user.check_password(password):
        return jsonify({'error': '账号或密码错误'}), 401
    
    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.utcnow() + timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)
    }, Config.SECRET_KEY, algorithm='HS256')
    
    return jsonify({
        'message': '登录成功',
        'token': token,
        'is_admin': user.is_admin,
        'user_id': user.id
    }), 200

@bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    # 实现退出逻辑
    return jsonify({'message': '退出成功'}), 200 