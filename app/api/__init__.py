#app/api/__init__.py

import os
from flask import Blueprint

# 创建蓝图
bp_auth = Blueprint('auth', __name__, url_prefix='/api/v1/auth')
bp_admin = Blueprint('admin', __name__, url_prefix='/api/v1/admin')
bp_user = Blueprint('user', __name__, url_prefix='/api/v1/users')
bp_files = Blueprint('files', __name__, url_prefix='/api/v1/files')
bp_message = Blueprint('message', __name__, url_prefix='/api/v1/messages')
bp_stats = Blueprint('stats', __name__, url_prefix='/api/v1/stats')

def init_app(app):
    # 导入路由模块
    from . import auth, admin, user, files, message, stats
    
    # 注册蓝图
    app.register_blueprint(bp_auth)
    app.register_blueprint(bp_admin)
    app.register_blueprint(bp_user)
    app.register_blueprint(bp_files)
    app.register_blueprint(bp_message)
    app.register_blueprint(bp_stats)
    
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