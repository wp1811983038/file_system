from flask import Flask, redirect, url_for, send_from_directory, render_template
from werkzeug.utils import safe_join
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user
from config import Config
import os
from flask_cors import CORS

# 初始化扩展
db = SQLAlchemy()
login_manager = LoginManager()

def create_app(config_class=Config):
    app = Flask(__name__)
    
    # 配置CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5000",
                "https://your-miniprogram-domain.com"
            ],
            "supports_credentials": True
        }
    })
    
    # 从配置对象加载配置
    app.config.from_object(config_class)
    
    # 确保上传目录存在
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['TEMPLATE_FOLDER'], exist_ok=True)
    os.makedirs(app.config['USER_FILES_FOLDER'], exist_ok=True)
    
    # 初始化扩展
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = '请先登录'
    
    # 注册 API 蓝图
    from app.api import init_app as init_api
    init_api(app)
    
    # 用户加载函数
    from app.models.user import User
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
    
    # 根路由
    @app.route('/')
    def index():
        return render_template('auth/login.html')
    
    # 静态文件路由
    @app.route('/templates/<path:path>')
    def serve_template_files(path):
        return send_from_directory('templates', path)
    
    # 模板文件访问路由
    @app.route('/uploads/templates/<path:filename>')
    def serve_template(filename):
        try:
            template_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'templates')
            filepath = safe_join(template_dir, filename)
            if not filepath or not os.path.exists(filepath):
                app.logger.error(f'文件不存在: {filepath}')
                return '文件不存在', 404
                
            return send_from_directory(
                template_dir,
                filename,
                as_attachment=False
            )
        except Exception as e:
            app.logger.error(f'文件访问错误: {str(e)}')
            return '文件访问失败', 500
    
    # 用户文件访问路由
    @app.route('/uploads/user_files/<path:filename>')
    def serve_user_file(filename):
        try:
            user_files_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'user_files')
            filepath = safe_join(user_files_dir, filename)
            if not filepath or not os.path.exists(filepath):
                app.logger.error(f'文件不存在: {filepath}')
                return '文件不存在', 404
                
            return send_from_directory(
                user_files_dir,
                filename,
                as_attachment=False
            )
        except Exception as e:
            app.logger.error(f'文件访问错误: {str(e)}')
            return '文件访问失败', 500
    
    return app