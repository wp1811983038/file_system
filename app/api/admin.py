from flask import Blueprint, jsonify, request, current_app, url_for
from app.models.user import User
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from app import db
from app.utils.auth import token_required, admin_required
from datetime import datetime
import os
from werkzeug.utils import secure_filename
from config import Config
from sqlalchemy.exc import SQLAlchemyError
from . import bp_admin as bp
from app.models.settings import Settings

@bp.route('/stats', methods=['GET'])
@token_required
@admin_required
def get_stats(current_user):
    """获取系统统计数据"""
    print("正在处理获取统计数据请求...")
    try:
        # 获取用户数量（不包括管理员）
        user_count = User.query.filter_by(is_admin=False).count()
        
        # 获取模板总数
        template_count = FileTemplate.query.count()
        
        # 计算提交率
        total_users = User.query.filter_by(is_admin=False).count()
        users_with_submissions = db.session.query(User).join(UserFile).filter(
            User.is_admin == False
        ).distinct().count()
        
        submission_rate = round((users_with_submissions / total_users * 100) if total_users > 0 else 0, 1)
        
        # 获取今日上传数
        today = datetime.now().date()
        today_uploads = UserFile.query.filter(
            db.func.date(UserFile.upload_date) == today
        ).count()
        
        stats = {
            'user_count': user_count,
            'template_count': template_count,
            'today_uploads': today_uploads
        }
        print(f"统计数据: {stats}")
        return jsonify(stats)
    except Exception as e:
        print(f"获取统计数据出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/activities', methods=['GET'])
@token_required
@admin_required
def get_activities(current_user):
    """获取活动列表"""
    try:
        activities = [
            {
                'id': 1,
                'username': '测试用户',
                'action': '上传了文件',
                'time': '2025-02-13 10:00:00'
            }
        ]
        return jsonify({
            'activities': activities
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/users', methods=['GET'])
@token_required
@admin_required
def get_users(current_user):
    """获取用户列表"""
    try:
        # 修改这里：移除 is_admin 的过滤，显示所有用户
        users = User.query.all()
        return jsonify({
            'users': [{
                'id': user.id,
                'username': user.username,
                'company_name': user.company_name,
                'contact_info': user.contact_info,
                'is_admin': user.is_admin,
                'file_count': UserFile.query.filter_by(user_id=user.id).count()
            } for user in users]
        })
    except Exception as e:
        current_app.logger.error(f"Error getting users: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/users/<int:user_id>', methods=['PUT'])
@token_required
@admin_required
def update_user(current_user, user_id):
    """更新用户信息"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    try:
        if 'username' in data:
            existing_user = User.query.filter_by(username=data['username']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': '用户名已存在'}), 400
            user.username = data['username']
            
        if 'company_name' in data:
            user.company_name = data['company_name']
        
        if 'contact_info' in data:
            # 添加手机号验证
            if data['contact_info'] and not validate_phone_number(data['contact_info']):
                return jsonify({'error': '请输入有效的手机号码'}), 400
            user.contact_info = data['contact_info']
            
        if 'is_admin' in data:
            user.is_admin = data['is_admin']
            
        db.session.commit()
        return jsonify({'message': '用户信息更新成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/submissions', methods=['GET'])
@token_required
@admin_required
def get_submissions(current_user):
    """获取文件提交情况"""
    try:
        template_id = request.args.get('template_id')
        if template_id:
            submissions = UserFile.query.filter_by(template_id=template_id).all()
        else:
            submissions = UserFile.query.all()
            
        return jsonify({
            'submissions': [{
                'id': sub.id,
                'user': {
                    'id': sub.user.id,
                    'username': sub.user.username,
                    'company_name': sub.user.company_name
                },
                'template': {
                    'id': sub.template.id,
                    'name': sub.template.name
                },
                'filename': sub.filename,
                'upload_date': sub.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
                'status': sub.status
            } for sub in submissions]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/templates/batch', methods=['POST'])
@token_required
@admin_required
def batch_template_operation(current_user):
    """批量处理模板"""
    data = request.get_json()
    if not data:
        return jsonify({'error': '无效的请求数据'}), 400
        
    operation = data.get('operation')
    template_ids = data.get('template_ids', [])
    
    if not template_ids:
        return jsonify({'error': '未选择模板'}), 400
        
    try:
        if operation == 'delete':
            for template_id in template_ids:
                template = FileTemplate.query.get(template_id)
                if template:
                    # 删除物理文件
                    if os.path.exists(template.file_path):
                        os.remove(template.file_path)
                    db.session.delete(template)
                    
            db.session.commit()
            return jsonify({'message': f'成功删除{len(template_ids)}个模板'})
            
        else:
            return jsonify({'error': '不支持的操作类型'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/templates', methods=['POST'])
@token_required
@admin_required
def create_template(current_user):
    """创建新模板"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件被上传'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400

        # 生成安全的文件名
        original_filename = file.filename
        safe_filename = secure_filename(original_filename)
        
        # 生成唯一文件名
        unique_filename = f"{datetime.now().timestamp()}_{safe_filename}"
        
        # 确保模板目录存在
        os.makedirs(current_app.config['TEMPLATE_FOLDER'], exist_ok=True)
        
        # 构建保存路径
        save_path = os.path.join(current_app.config['TEMPLATE_FOLDER'], unique_filename)
        
        # 保存文件
        file.save(save_path)
        
        # 生成访问URL
        file_url = url_for('static', 
                          filename=f'uploads/templates/{unique_filename}', 
                          _external=True)
        
        # 创建数据库记录
        template = FileTemplate(
            name=request.form.get('name', safe_filename),
            description=request.form.get('description', ''),
            filename=original_filename,
            file_path=save_path,
            file_url=file_url
        )
        
        db.session.add(template)
        db.session.commit()
        
        return jsonify({
            'message': '模板创建成功',
            'template': template.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Error creating template: {str(e)}")
        db.session.rollback()
        if 'save_path' in locals() and os.path.exists(save_path):
            try:
                os.remove(save_path)
            except Exception as e:
                current_app.logger.error(f"Error removing file: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@bp.route('/templates/<int:template_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_template(current_user, template_id):
    """删除模板"""
    try:
        template = FileTemplate.query.get_or_404(template_id)
        
        # 删除物理文件
        if os.path.exists(template.file_path):
            os.remove(template.file_path)
            
        # 删除数据库记录
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': '模板删除成功'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting template: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@bp.route('/templates', methods=['GET'])
@token_required
@admin_required
def get_templates(current_user):
    try:
        templates = FileTemplate.query.filter_by(is_active=True).all()
        template_list = []
        
        # 获取非管理员用户总数
        total_users = User.query.filter_by(is_admin=False).count()
        
        for t in templates:
            # 获取该模板的提交数量
            submitted_count = UserFile.query.filter_by(template_id=t.id).count()
            
            template_data = {
                'id': t.id,
                'name': t.name,
                'description': t.description,
                'filename': t.filename,
                'upload_date': t.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'file_path': t.file_path,
                'file_url': t.file_url,
                'total_users': total_users,  # 添加用户总数
                'submitted_count': submitted_count  # 添加提交数量
            }
            template_list.append(template_data)
            
        return jsonify(template_list)
    except Exception as e:
        current_app.logger.error(f"获取模板列表异常: {str(e)}")
        return jsonify({'error': str(e)}), 500
    


@bp.route('/templates/<int:template_id>', methods=['POST', 'PUT'])
@token_required
@admin_required
def update_template(current_user, template_id):
    """更新模板"""
    try:
        template = FileTemplate.query.get_or_404(template_id)
        
        # 处理文件上传
        if 'file' in request.files:
            file = request.files['file']
            if file.filename:
                # 保存原始文件名（包含扩展名）
                original_filename = file.filename
                # 生成安全的文件名用于存储
                safe_filename = secure_filename(original_filename)
                unique_filename = f"{datetime.now().timestamp()}_{safe_filename}"
                
                # 保存新文件
                save_path = os.path.join(current_app.config['TEMPLATE_FOLDER'], unique_filename)
                file.save(save_path)
                
                # 删除旧文件
                if os.path.exists(template.file_path):
                    os.remove(template.file_path)
                    
                # 更新文件相关信息
                template.filename = original_filename  # 使用原始文件名，包含扩展名
                template.file_path = save_path
                template.file_url = url_for('static', 
                                          filename=f'uploads/templates/{unique_filename}', 
                                          _external=True)
        
        # 更新其他字段
        if 'name' in request.form:
            template.name = request.form['name']
        if 'description' in request.form:
            template.description = request.form['description']
            
        db.session.commit()
        return jsonify({
            'message': '更新成功',
            'template': {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'filename': template.filename  # 返回完整的文件名
            }
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating template: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@bp.route('/templates/check-name', methods=['POST'])
@token_required
@admin_required
def check_template_name(current_user):
    name = request.json.get('name', '').strip()
    if not name:
        return jsonify({'available': False}), 400
        
    existing = FileTemplate.query.filter(
        db.func.lower(FileTemplate.name) == db.func.lower(name)
    ).first()
    
    return jsonify({'available': not bool(existing)})

import re

def validate_phone_number(phone):
    """验证手机号是否有效"""
    # 中国大陆手机号正则表达式验证
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None



@bp.route('/users', methods=['POST'])
@token_required
@admin_required
def create_user(current_user):
    """创建新用户"""
    data = request.get_json()
    print("接收到的创建用户数据:", data)
    
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': '用户名和密码不能为空'}), 400
        
    # 检查用户名是否已存在
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': '用户名已存在'}), 400
    
    # 验证手机号
    contact_info = data.get('contact_info')
    if contact_info and not validate_phone_number(contact_info):
        return jsonify({'error': '请输入有效的手机号码'}), 400
    
    try:
        # 打印更多调试信息
        print("准备创建用户:", {
            'username': data['username'],
            'company_name': data.get('company_name'),
            'contact_info': data.get('contact_info'),
            'is_admin': data.get('is_admin', False)
        })
        
        user = User(
            username=data['username'],
            company_name=data.get('company_name'),
            contact_info=data.get('contact_info'),
            is_admin=data.get('is_admin', False)
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': '用户创建成功',
            'user': {
                'id': user.id,
                'username': user.username,
                'company_name': user.company_name,
                'contact_info': user.contact_info,
                'is_admin': user.is_admin
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        print("创建用户时出错:", str(e))
        return jsonify({'error': str(e)}), 500
    

@bp.route('/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(current_user, user_id):
    """删除用户"""
    try:
        user = User.query.get_or_404(user_id)
        
        # 防止删除管理员用户
        if user.is_admin:
            return jsonify({'error': '不能删除管理员用户'}), 400
            
        # 删除用户相关的文件
        user_files = UserFile.query.filter_by(user_id=user_id).all()
        for file in user_files:
            if os.path.exists(file.file_path):
                os.remove(file.file_path)
            db.session.delete(file)
            
        # 删除用户
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': '用户删除成功'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting user: {str(e)}")
        return jsonify({'error': str(e)}), 500
    



#设置系统名称和描述
@bp.route('/settings', methods=['GET'])
@token_required
def get_settings(current_user):
    """获取系统设置"""
    try:
        settings = Settings.query.first()
        if not settings:
            settings = Settings(
                system_name="文件管理系统",
                system_description=""
            )
            db.session.add(settings)
            db.session.commit()
        
        return jsonify({
            'system_name': settings.system_name,
            'system_description': settings.system_description
        })
    except Exception as e:
        current_app.logger.error(f"获取设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/settings', methods=['PUT'])
@token_required
@admin_required
def update_settings(current_user):
    """更新系统设置"""
    try:
        data = request.get_json()
        settings = Settings.query.first()
        
        if not settings:
            settings = Settings()
            db.session.add(settings)
            
        settings.system_name = data.get('system_name', '文件管理系统')
        settings.system_description = data.get('system_description', '')
        
        db.session.commit()
        return jsonify({'message': '设置更新成功'})
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"更新设置失败: {str(e)}")
        return jsonify({'error': str(e)}), 500