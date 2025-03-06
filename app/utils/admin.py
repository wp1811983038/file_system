from functools import wraps
from flask import jsonify
from app.utils.auth import token_required

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'error': '需要管理员权限'}), 403
        return f(current_user, *args, **kwargs)
    return decorated 