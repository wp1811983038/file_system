#app/api/__init__.py

from flask import Blueprint

# 创建蓝图
bp_auth = Blueprint('auth', __name__, url_prefix='/api/v1/auth')
bp_admin = Blueprint('admin', __name__, url_prefix='/api/v1/admin')
bp_user = Blueprint('user', __name__, url_prefix='/api/v1/users')
bp_files = Blueprint('files', __name__, url_prefix='/api/v1/files')
bp_approvals = Blueprint('approvals', __name__, url_prefix='/api/v1/approvals')  # 新增审批蓝图

def init_app(app):
    # 导入路由模块
    from . import auth, admin, user, files, approvals  # 添加 approvals
    
    # 注册蓝图
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_admin)
    app.register_blueprint(bp_user)
    app.register_blueprint(bp_files)
    app.register_blueprint(bp_approvals)  # 注册审批蓝图