# app/services/message_service.py
from app import db
from app.models.message import Message
from app.models.user import User
from app.models.user_file import UserFile
from app.models.file_template import FileTemplate
from flask import current_app
import traceback

class MessageService:
    """消息服务 - 与现有的notification_service配合使用"""
    
    @staticmethod
    def create_system_message(user_id, title, content):
        """创建系统消息"""
        try:
            message = Message(
                user_id=user_id,
                title=title,
                content=content,
                type='system'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"系统消息创建成功: user_id={user_id}, title={title}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建系统消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
    
    @staticmethod
    def create_file_process_message(user_id, file_id, status, comments=''):
        """创建文件处理消息 - 对应审批结果"""
        try:
            # 查询文件信息
            user_file = UserFile.query.get(file_id)
            if not user_file:
                current_app.logger.error(f"文件不存在: file_id={file_id}")
                return None
            
            # 构建消息标题和内容
            if status == 'approved':
                title = f"您的文件已审批通过"
                content = f"您提交的文件《{user_file.template.name}》已审批通过。"
            elif status == 'rejected':
                title = f"您的文件未能通过审批"
                content = f"您提交的文件《{user_file.template.name}》未能通过审批。"
            else:
                title = f"您的文件审批状态已更新"
                content = f"您提交的文件《{user_file.template.name}》审批状态已更新。"
            
            if comments:
                content += f"\n\n审批意见: {comments}"
            
            # 创建消息
            message = Message(
                user_id=user_id,
                title=title,
                content=content,
                type='file_process',
                related_id=file_id,
                related_type='user_file'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"文件处理消息创建成功: user_id={user_id}, file_id={file_id}, status={status}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建文件处理消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
    
    @staticmethod
    def create_file_receive_message(user_id, template_id):
        """创建文件接收消息 - 对应新模板通知"""
        try:
            # 查询模板信息
            template = FileTemplate.query.get(template_id)
            if not template:
                current_app.logger.error(f"模板不存在: template_id={template_id}")
                return None
            
            # 构建消息标题和内容
            title = f"新文件模板: {template.name}"
            content = f"系统发布了新的文件模板: 《{template.name}》\n\n"
            if template.description:
                content += f"模板说明: {template.description}\n\n"
            content += "请尽快提交对应文件。"
            
            # 创建消息
            message = Message(
                user_id=user_id,
                title=title,
                content=content,
                type='file_receive',
                related_id=template_id,
                related_type='file_template'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"文件接收消息创建成功: user_id={user_id}, template_id={template_id}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建文件接收消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
    
    @staticmethod
    def broadcast_to_all_users(title, content, type='system', admin_only=False):
        """广播消息给所有用户"""
        try:
            # 查询用户
            query = User.query
            if admin_only:
                query = query.filter_by(is_admin=True)
            else:
                query = query.filter_by(is_admin=False)  # 默认只发给普通用户
            
            users = query.all()
            message_count = 0
            
            for user in users:
                message = Message(
                    user_id=user.id,
                    title=title,
                    content=content,
                    type=type
                )
                db.session.add(message)
                message_count += 1
            
            db.session.commit()
            
            current_app.logger.info(f"广播消息成功: 发送了{message_count}条消息")
            return message_count
        except Exception as e:
            current_app.logger.error(f"广播消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return 0