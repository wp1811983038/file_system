# app/api/message.py
from flask import jsonify, request, current_app
from app.models.message import Message
from app.models.user_file import UserFile
from app.models.file_template import FileTemplate
from app import db
from app.utils.auth import token_required
from . import bp_message as bp
import traceback

# 获取消息列表
@bp.route('', methods=['GET'])
@token_required
def get_messages(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        message_type = request.args.get('type', None)
        
        # 构建查询
        query = Message.query.filter_by(user_id=current_user.id)
        
        # 应用过滤
        if message_type:
            query = query.filter_by(type=message_type)
            
        # 按时间降序排序
        query = query.order_by(Message.created_at.desc())
        
        # 分页
        pagination = query.paginate(page=page, per_page=per_page)
        
        # 准备响应
        messages = []
        for message in pagination.items:
            message_data = message.to_dict()
            
            # 添加关联信息
            if message.related_id and message.related_type:
                if message.related_type == 'user_file':
                    file = UserFile.query.get(message.related_id)
                    if file:
                        message_data['related_info'] = {
                            'filename': file.filename,
                            'template_name': file.template.name if file.template else None,
                            'status': file.status
                        }
                elif message.related_type == 'file_template':
                    template = FileTemplate.query.get(message.related_id)
                    if template:
                        message_data['related_info'] = {
                            'name': template.name,
                            'description': template.description
                        }
            
            messages.append(message_data)
        
        return jsonify({
            'messages': messages,
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        })
    except Exception as e:
        current_app.logger.error(f"获取消息列表失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取未读消息数
@bp.route('/unread/count', methods=['GET'])
@token_required
def get_unread_count(current_user):
    try:
        count = Message.query.filter_by(
            user_id=current_user.id,
            status='unread'
        ).count()
        
        return jsonify({
            'count': count
        })
    except Exception as e:
        current_app.logger.error(f"获取未读消息数失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取消息详情
@bp.route('/<int:message_id>', methods=['GET'])
@token_required
def get_message(current_user, message_id):
    try:
        message = Message.query.filter_by(
            id=message_id, 
            user_id=current_user.id
        ).first_or_404()
        
        # 自动标记为已读
        if message.status == 'unread':
            message.status = 'read'
            db.session.commit()
        
        message_data = message.to_dict()
        
        # 添加关联信息
        if message.related_id and message.related_type:
            if message.related_type == 'user_file':
                file = UserFile.query.get(message.related_id)
                if file:
                    message_data['related_info'] = {
                        'id': file.id,
                        'filename': file.filename,
                        'template_id': file.template_id,
                        'template_name': file.template.name if file.template else None,
                        'status': file.status,
                        'upload_date': file.upload_date.strftime('%Y-%m-%d %H:%M:%S') if file.upload_date else None
                    }
            elif message.related_type == 'file_template':
                template = FileTemplate.query.get(message.related_id)
                if template:
                    message_data['related_info'] = {
                        'id': template.id,
                        'name': template.name,
                        'description': template.description,
                        'created_at': template.created_at.strftime('%Y-%m-%d %H:%M:%S') if template.created_at else None
                    }
        
        return jsonify(message_data)
    except Exception as e:
        current_app.logger.error(f"获取消息详情失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 标记所有消息为已读
@bp.route('/read/all', methods=['PUT'])
@token_required
def mark_all_as_read(current_user):
    try:
        result = Message.query.filter_by(
            user_id=current_user.id,
            status='unread'
        ).update({'status': 'read'})
        
        db.session.commit()
        
        return jsonify({
            'message': '所有消息已标记为已读',
            'updated_count': result
        })
    except Exception as e:
        current_app.logger.error(f"标记所有消息已读失败: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500