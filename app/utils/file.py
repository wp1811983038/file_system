from flask import current_app
import os

def allowed_file(filename):
    """检查文件类型是否允许
    现在默认允许所有文件类型，但仍然需要有文件扩展名
    """
    return '.' in filename  # 只检查文件是否有扩展名

def get_file_url(file_path):
    """根据文件路径生成访问URL"""
    if not file_path:
        return None
    
    static_folder = os.path.join(current_app.config['BASE_DIR'], 'app', 'static')
    if file_path.startswith(static_folder):
        relative_path = os.path.relpath(file_path, static_folder)
        return url_for('static', filename=relative_path, _external=True)
    return None 