from flask import current_app, url_for
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



def allowed_avatar_file(filename):
    """验证上传的头像文件是否符合要求"""
    from config import Config
    
    # 检查文件扩展名
    extension = filename.split('.')[-1].lower() if '.' in filename else ''
    return extension in Config.ALLOWED_AVATAR_EXTENSIONS

def validate_avatar(file):
    """验证头像文件是否有效并符合大小要求"""
    from config import Config
    
    if not file or file.filename == '':
        return False, '请选择头像文件'
        
    if not allowed_avatar_file(file.filename):
        return False, f'仅支持 {", ".join(Config.ALLOWED_AVATAR_EXTENSIONS)} 格式的图片'
    
    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # 重置文件指针
    
    if file_size > Config.MAX_AVATAR_SIZE:
        return False, f'头像文件不能超过 {Config.MAX_AVATAR_SIZE/1024/1024}MB'
    
    return True, ''