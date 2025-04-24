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
        
    @staticmethod
    def create_inspection_notification(user_id, inspection, enforcer_name):
        """创建检查通知"""
        try:
            # 确定通知类型和内容
            if inspection.status == 'pending':
                title = "检查任务通知"
                content = f"执法人员 {enforcer_name} 将于 {inspection.planned_date.strftime('%Y-%m-%d')} 对您的企业进行{inspection.inspection_type}。"
                if inspection.description:
                    content += f"\n\n检查内容: {inspection.description}"
            else:
                title = "检查结果通知"
                problem_count = inspection.problems.count()
                content = f"执法人员 {enforcer_name} 已完成对您企业的检查。"
                content += f"\n发现问题 {problem_count} 项，请注意及时整改。"
            
            # 创建消息
            message = Message(
                user_id=user_id,
                title=title,
                content=content,
                type='system'
            )
            db.session.add(message)
            db.session.commit()
            
            return message
        except Exception as e:
            current_app.logger.error(f"创建检查通知失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
        
    @staticmethod
    def create_inspection_notice_message(user_id, inspection_id, inspection_type, planned_datetime, description, basis=''):
        """创建执法检查通知消息"""
        try:
            # 构建通知内容
            content = f"执法部门将于 {planned_datetime} 对您的企业进行{inspection_type}。\n\n"
            content += f"检查内容：{description}\n"
            if basis:
                content += f"检查依据：{basis}\n"
            content += "\n请做好相关准备工作。"
            
            # 创建消息
            message = Message(
                user_id=user_id,
                title="执法检查通知",
                content=content,
                type='inspection_notice',  # 使用新的消息类型
                related_id=inspection_id,
                related_type='inspection'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"执法检查通知创建成功: user_id={user_id}, inspection_id={inspection_id}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建执法检查通知失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
        
    @staticmethod
    def create_inspection_message(user_id, title, content, inspection_id=None):
        """创建执法检查消息"""
        try:
            message = Message(
                user_id=user_id,
                title=title,
                content=content,
                type='inspection_notice',  # 正确设置类型
                related_id=inspection_id,
                related_type='inspection'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"执法检查消息创建成功: user_id={user_id}, title={title}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建执法检查消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
        

    @staticmethod
    def create_feedback_message(feedback_id, user_id, feedback_type, feedback_content):
        """创建反馈通知消息 - 发送给管理员"""
        try:
            # 获取所有管理员
            admins = User.query.filter_by(is_admin=True).all()
            
            if not admins:
                current_app.logger.warning("未找到管理员用户，无法发送反馈通知")
                return False
                
            # 获取用户信息
            user = User.query.get(user_id)
            username = user.username if user else "未知用户"
            
            # 构建消息标题和内容
            title = f"新的用户反馈：{feedback_type}"
            
            # 截取内容前50个字符作为预览
            content_preview = feedback_content[:50] + ('...' if len(feedback_content) > 50 else '')
            content = f"用户 {username} 提交了新的反馈。\n\n类型：{feedback_type}\n\n内容：{content_preview}"
            
            # 为每位管理员创建消息
            message_count = 0
            for admin in admins:
                message = Message(
                    user_id=admin.id,
                    title=title,
                    content=content,
                    type='feedback',  # 使用反馈类型
                    related_id=feedback_id,
                    related_type='feedback'
                )
                db.session.add(message)
                message_count += 1
            
            db.session.commit()
            
            current_app.logger.info(f"反馈通知已发送给{message_count}位管理员")
            return message_count > 0
        except Exception as e:
            current_app.logger.error(f"创建反馈通知消息失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return False
        

    @staticmethod
    def create_submission_notice(admin_id, user_id, file_id, template_name, filename):
        """创建文件提交通知 - 发送给管理员"""
        try:
            # 查询用户信息
            user = User.query.get(user_id)
            if not user:
                current_app.logger.error(f"用户不存在: user_id={user_id}")
                return None
                
            # 构建消息标题和内容
            title = f"新文件提交通知"
            content = f"用户 {user.username}"
            if user.company_name:
                content += f" ({user.company_name})"
            content += f' 提交了文件"{filename}"，模板类型：{template_name}，请及时审核。'
            
            # 创建消息
            message = Message(
                user_id=admin_id,
                title=title,
                content=content,
                type='submission_notice',
                related_id=file_id,
                related_type='user_file'
            )
            db.session.add(message)
            db.session.commit()
            
            current_app.logger.info(f"文件提交通知创建成功: admin_id={admin_id}, file_id={file_id}")
            return message
        except Exception as e:
            current_app.logger.error(f"创建文件提交通知失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
                            


    