# config.py
import os
from datetime import timedelta

class Config:
    # 基础配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or '1811983038'
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # MySQL配置
    MYSQL_HOST = 'localhost'
    MYSQL_PORT = 3306
    MYSQL_USER = 'root'  # 修改为你的MySQL用户名
    MYSQL_PASSWORD = '1811983038'  # 修改为你的MySQL密码
    MYSQL_DATABASE = 'file_system'
    
    # SQLAlchemy配置
    SQLALCHEMY_DATABASE_URI = f'mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 上传文件相关配置
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'app', 'static', 'uploads')
    TEMPLATE_FOLDER = os.path.join(UPLOAD_FOLDER, 'templates')  # 管理员上传的模板文件
    USER_FILES_FOLDER = os.path.join(UPLOAD_FOLDER, 'user_files')  # 用户上传的文件
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {'*'}  # 允许所有文件类型
    
    # Session配置
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # JWT配置
    JWT_ACCESS_TOKEN_EXPIRES = 24 * 60 * 60  # 以秒为单位（24小时）



    # 微信小程序配置
    WX_APP_ID = 'wx6e1d24122be5da2f'  # 替换为你的小程序AppID
    WX_APP_SECRET = '8f376d8c3d21bf993cda665b7573529d'  # 替换为你的小程序AppSecret
    
    # 微信订阅消息模板ID
    WX_TEMPLATE_FILE_RECEIVE = 'NStXO1lTsJkqfczwVeyCo9gQpKupn3kILvLet6iMqiM'  # 收到文件通知
    WX_TEMPLATE_FILE_PROCESS = 'FaiHqSy6DgS7csoZNllV_62pv2Tv9oagseeaqcX8eyM'  # 文件处理结果通知


class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # 生产环境下的其他配置...

# 配置映射
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

