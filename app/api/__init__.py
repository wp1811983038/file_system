#app/api/__init__.py

import os
from flask import Blueprint
from app.utils.auth import token_required, admin_required, enforcer_required


# 创建蓝图
bp_auth = Blueprint('auth', __name__, url_prefix='/api/v1/auth')
bp_admin = Blueprint('admin', __name__, url_prefix='/api/v1/admin')
bp_user = Blueprint('user', __name__, url_prefix='/api/v1/users')
bp_files = Blueprint('files', __name__, url_prefix='/api/v1/files')
bp_message = Blueprint('message', __name__, url_prefix='/api/v1/messages')
bp_stats = Blueprint('stats', __name__, url_prefix='/api/v1/stats')
bp_enforcer = Blueprint('enforcer', __name__, url_prefix='/api/v1/enforcer')  # 新增执法端蓝图
bp_feedback = Blueprint('feedback',  __name__, url_prefix='/api/v1/feedback')  # 新增反馈蓝图
bp_logs = Blueprint('logs', __name__, url_prefix='/api/v1/admin/logs')

def init_app(app):
    # 导入路由模块
    from . import auth, admin, user, files, message, stats, enforcer, feedback,logs   
    
    # 注册蓝图
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_admin)
    app.register_blueprint(bp_user)
    app.register_blueprint(bp_files)
    app.register_blueprint(bp_message)
    app.register_blueprint(bp_stats)
    app.register_blueprint(bp_enforcer)  # 注册执法端蓝图
    app.register_blueprint(bp_feedback)  # 注册反馈蓝图
    app.register_blueprint(bp_logs)
    
    
    # 添加调试信息
    # print("已注册的蓝图:")
    # for blueprint in app.blueprints:
    #     print(f"- {blueprint}: {app.blueprints[blueprint].url_prefix}") 

    # 确保头像目录存在
    os.makedirs(app.config['AVATAR_FOLDER'], exist_ok=True)
    
    # 确保默认头像存在
    default_avatar_path = os.path.join(app.root_path, 'static', 'images')
    os.makedirs(default_avatar_path, exist_ok=True)
    
    # 如果默认头像不存在，可以复制一个默认头像或创建提示
    default_avatar_file = os.path.join(default_avatar_path, 'default-avatar.png')
    if not os.path.exists(default_avatar_file):
        # 提示需要添加默认头像
        print("请在 app/static/images/ 目录下添加 default-avatar.png 文件作为默认头像")