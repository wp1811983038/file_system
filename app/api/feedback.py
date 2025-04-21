# app/api/feedback.py
import os
import traceback
from flask import jsonify, request, current_app, url_for
from app.models.feedback import Feedback
from app import db
from app.utils.auth import token_required, admin_required
from datetime import datetime
from werkzeug.utils import secure_filename
from . import bp_feedback as bp

# 创建反馈
@bp.route('', methods=['POST'])
@token_required
def create_feedback(current_user):
    """创建用户反馈"""
    try:
        data = request.get_json()
        
        # 验证请求数据
        if not data or not data.get('content') or not data.get('type'):
            return jsonify({'error': '缺少必要参数'}), 400
            
        # 创建反馈记录
        feedback = Feedback(
            user_id=current_user.id,
            type=data['type'],
            content=data['content'],
            contact_info=data.get('contact_info', current_user.contact_info),
            image_urls=','.join(data.get('image_urls', [])),
            status='pending'
        )
        
        db.session.add(feedback)
        db.session.commit()
        
        # 可以在这里添加通知管理员的逻辑
        # ...
        
        return jsonify({
            'message': '反馈提交成功',
            'feedback': feedback.to_dict()
        }), 201
    except Exception as e:
        current_app.logger.error(f"创建反馈失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
        
# 上传反馈图片
@bp.route('/upload', methods=['POST'])
@token_required
def upload_feedback_image(current_user):
    """上传反馈图片"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': '未选择图片'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': '未选择图片'}), 400
            
        # 验证文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
        if not file.filename.lower().endswith(tuple('.' + ext for ext in allowed_extensions)):
            return jsonify({'error': '不支持的图片格式'}), 400
            
        # 验证文件大小
        if len(file.read()) > 2 * 1024 * 1024:  # 2MB
            return jsonify({'error': '图片大小不能超过2MB'}), 400
            
        # 重置文件指针
        file.seek(0)
        
        # 生成安全的文件名
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        original_filename = secure_filename(file.filename)
        filename = f"feedback_{current_user.id}_{timestamp}_{original_filename}"
        
        # 确保目录存在
        upload_folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'feedback')
        os.makedirs(upload_folder, exist_ok=True)
        
        # 保存文件
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # 生成访问URL
        file_url = url_for('static', 
                          filename=f'uploads/feedback/{filename}', 
                          _external=True)
        
        return jsonify({
            'message': '图片上传成功',
            'file_url': file_url
        })
    except Exception as e:
        current_app.logger.error(f"上传反馈图片失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取当前用户的反馈列表
@bp.route('', methods=['GET'])
@token_required
def get_user_feedbacks(current_user):
    """获取当前用户的反馈列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        query = Feedback.query.filter_by(user_id=current_user.id)
        query = query.order_by(Feedback.created_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page)
        
        feedbacks = [feedback.to_dict() for feedback in pagination.items]
        
        return jsonify({
            'feedbacks': feedbacks,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    except Exception as e:
        current_app.logger.error(f"获取用户反馈列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取反馈详情
@bp.route('/<int:feedback_id>', methods=['GET'])
@token_required
def get_feedback(current_user, feedback_id):
    """获取反馈详情"""
    try:
        # 普通用户只能查看自己的反馈，管理员可以查看所有反馈
        query = Feedback.query
        
        if not current_user.is_admin:
            query = query.filter_by(user_id=current_user.id)
            
        feedback = query.filter_by(id=feedback_id).first_or_404()
        
        return jsonify(feedback.to_dict())
    except Exception as e:
        current_app.logger.error(f"获取反馈详情失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 管理员回复反馈
@bp.route('/<int:feedback_id>/reply', methods=['POST'])
@token_required
@admin_required
def reply_feedback(current_user, feedback_id):
    """管理员回复反馈"""
    try:
        data = request.get_json()
        
        if not data or not data.get('comment'):
            return jsonify({'error': '回复内容不能为空'}), 400
            
        feedback = Feedback.query.get_or_404(feedback_id)
        
        feedback.admin_comment = data['comment']
        feedback.status = data.get('status', 'processing')
        feedback.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # 可以添加通知用户的逻辑
        # ...
        
        return jsonify({
            'message': '回复成功',
            'feedback': feedback.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"回复反馈失败: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 管理员获取所有反馈
@bp.route('/admin/list', methods=['GET'])
@token_required
@admin_required
def get_all_feedbacks(current_user):
    """管理员获取所有反馈"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        status = request.args.get('status', '')
        
        query = Feedback.query
        
        if status:
            query = query.filter_by(status=status)
            
        query = query.order_by(Feedback.created_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page)
        
        feedbacks = [feedback.to_dict() for feedback in pagination.items]
        
        return jsonify({
            'feedbacks': feedbacks,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    except Exception as e:
        current_app.logger.error(f"获取所有反馈失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 更新反馈状态
@bp.route('/<int:feedback_id>/status', methods=['PUT'])
@token_required
@admin_required
def update_feedback_status(current_user, feedback_id):
    """更新反馈状态"""
    try:
        data = request.get_json()
        
        if not data or not data.get('status'):
            return jsonify({'error': '状态不能为空'}), 400
            
        feedback = Feedback.query.get_or_404(feedback_id)
        
        feedback.status = data['status']
        feedback.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': '状态更新成功',
            'feedback': feedback.to_dict()
        })
    except Exception as e:
        current_app.logger.error(f"更新反馈状态失败: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500