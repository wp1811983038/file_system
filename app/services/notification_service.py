# app/services/notification_service.py
from datetime import datetime, timedelta
from flask import current_app
from app import db
from app.models.user import User
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from app.models.wx_subscription import WxSubscription
from app.models.wx_notification_log import WxNotificationLog
from app.services.wx_service import WxService

class NotificationService:
    """通知服务类 - 封装发送微信订阅消息的业务逻辑"""
    
    @staticmethod
    def send_file_review_notification(user_id, file_id):
        """发送文件审核结果通知
        
        Args:
            user_id: 用户ID
            file_id: 文件ID
            
        Returns:
            bool: 发送结果，成功返回True，失败返回False
        """
        try:
            # 查询用户信息
            user = User.query.get(user_id)
            if not user or not user.openid:
                current_app.logger.info(f"用户不存在或未绑定openid: user_id={user_id}")
                return False
            
            # 查询用户订阅状态
            subscription = WxSubscription.query.filter_by(user_id=user_id).first()
            if not subscription or subscription.file_process_status != 'accept':
                current_app.logger.info(f"用户未订阅文件处理结果通知: user_id={user_id}")
                return False
            
            # 查询文件信息
            user_file = UserFile.query.get(file_id)
            if not user_file:
                current_app.logger.error(f"文件不存在: file_id={file_id}")
                return False
            
            # 查询模板信息
            template = FileTemplate.query.get(user_file.template_id)
            if not template:
                current_app.logger.error(f"模板不存在: template_id={user_file.template_id}")
                return False
            
            # 确保文件名和模板名不为空
            file_name = user_file.filename or "用户提交文件"
            template_name = template.name or "系统模板"
            
            # 准备通知内容
            result_text = "审核不通过" if user_file.status == 'rejected' else "审核通过"
            note_text = "请检查并重新提交" if user_file.status == 'rejected' else "感谢您的提交"
            
            # 限制字段长度，按照模板要求裁剪
            file_name = file_name[:20]
            template_name = template_name[:20]
            note_text = note_text[:20]
            
            # 根据模板图片2显示的正确字段名准备数据
            data = {
                "thing1": {"value": file_name},                # 文件名称
                "short_thing2": {"value": template_name[:5]},  # 文件类型，short_thing最多5个字符
                "short_thing4": {"value": result_text[:5]},    # 处理结果，short_thing最多5个字符
                "thing5": {"value": note_text}                 # 备注
            }
            
            # 确保所有字段都有值
            for key, field in data.items():
                if not field["value"]:
                    data[key]["value"] = "未知"  # 默认值，防止字段为空
            
            # 记录日志
            current_app.logger.info(f"准备发送审核通知: user_id={user_id}, file_id={file_id}, data={data}")
            
            # 记录通知日志
            notification_log = WxNotificationLog(
                user_id=user_id,
                template_id=current_app.config['WX_TEMPLATE_FILE_PROCESS'],
                openid=user.openid,
                file_id=file_id,
                notification_type='file_review',
                content=str(data),
                status='pending'
            )
            db.session.add(notification_log)
            db.session.commit()
            
            # 发送通知
            result = WxService.send_subscription_message(
                openid=user.openid,
                template_id=current_app.config['WX_TEMPLATE_FILE_PROCESS'],
                data=data,
                page=f"pages/user/files/list"  # 通知点击后的跳转页面
            )
            
            # 更新通知状态
            notification_log.status = 'sent' if result else 'failed'
            if not result:
                notification_log.error_msg = '发送失败'
            db.session.commit()
            
            return result
        except Exception as e:
            current_app.logger.error(f"发送审核通知异常: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return False
    
    @staticmethod
    def send_file_reminder_notification(user_id, template_id):
        """发送文件提交提醒通知
        
        Args:
            user_id: 用户ID
            template_id: 模板ID
            
        Returns:
            bool: 发送结果，成功返回True，失败返回False
        """
        try:
            # 查询用户信息
            user = User.query.get(user_id)
            if not user or not user.openid:
                current_app.logger.info(f"用户不存在或未绑定openid: user_id={user_id}")
                return False
            
            # 查询用户订阅状态
            subscription = WxSubscription.query.filter_by(user_id=user_id).first()
            if not subscription or subscription.file_receive_status != 'accept':
                current_app.logger.info(f"用户未订阅文件接收通知: user_id={user_id}")
                return False
            
            # 查询模板信息
            template = FileTemplate.query.get(template_id)
            if not template:
                current_app.logger.error(f"模板不存在: template_id={template_id}")
                return False
            
            # 确保模板名不为空
            template_name = template.name or "系统模板"
            
            # 准备时间信息
            now = datetime.now()
            now_str = now.strftime("%Y年%m月%d日 %H:%M")
            deadline_str = (now + timedelta(days=7)).strftime("%Y年%m月%d日 %H:%M")
            
            # 限制字段长度，按照模板要求裁剪
            template_name = template_name[:20]
            
            # 根据模板图片1显示的正确字段名准备数据
            data = {
                "thing1": {"value": template_name},  # 文件名称
                "time2": {"value": now_str},         # 接收时间
                "time4": {"value": now_str},         # 发放时间
                "thing5": {"value": "系统通知"},      # 发放人
                "time6": {"value": deadline_str}     # 到期时间
            }
            
            # 确保所有字段都有值
            for key, field in data.items():
                if not field["value"]:
                    data[key]["value"] = "未知"  # 默认值，防止字段为空
            
            # 记录日志
            current_app.logger.info(f"准备发送提交提醒: user_id={user_id}, template_id={template_id}, data={data}")
            
            # 记录通知日志
            notification_log = WxNotificationLog(
                user_id=user_id,
                template_id=current_app.config['WX_TEMPLATE_FILE_RECEIVE'],
                openid=user.openid,
                file_id=None,
                notification_type='file_reminder',
                content=str(data),
                status='pending'
            )
            db.session.add(notification_log)
            db.session.commit()
            
            # 发送通知
            result = WxService.send_subscription_message(
                openid=user.openid,
                template_id=current_app.config['WX_TEMPLATE_FILE_RECEIVE'],
                data=data,
                page=f"pages/user/files/list"  # 通知点击后的跳转页面
            )
            
            # 更新通知状态
            notification_log.status = 'sent' if result else 'failed'
            if not result:
                notification_log.error_msg = '发送失败'
            db.session.commit()
            
            return result
        except Exception as e:
            current_app.logger.error(f"发送提交提醒异常: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            return False
    
    @staticmethod
    def check_and_send_pending_notifications():
        """检查未处理的通知并重新发送
        用于处理因网络问题等原因发送失败的通知
        """
        try:
            # 获取过去24小时内状态为failed的通知
            yesterday = datetime.utcnow() - timedelta(hours=24)
            pending_logs = WxNotificationLog.query.filter(
                WxNotificationLog.status == 'failed',
                WxNotificationLog.created_at >= yesterday
            ).all()
            
            success_count = 0
            fail_count = 0
            
            for log in pending_logs:
                # 重新获取用户信息，确保用户仍然存在
                user = User.query.get(log.user_id)
                if not user or not user.openid:
                    continue
                
                # 检查用户是否仍然订阅相关通知
                subscription = WxSubscription.query.filter_by(user_id=log.user_id).first()
                if not subscription:
                    continue
                
                # 根据通知类型确定订阅状态
                if log.notification_type == 'file_review' and subscription.file_process_status != 'accept':
                    continue
                if log.notification_type == 'file_reminder' and subscription.file_receive_status != 'accept':
                    continue
                
                # 尝试从通知内容字符串中解析数据
                try:
                    import ast
                    data = ast.literal_eval(log.content)
                except:
                    continue
                
                # 重新发送通知
                result = WxService.send_subscription_message(
                    openid=log.openid,
                    template_id=log.template_id,
                    data=data,
                    page="pages/user/files/list"
                )
                
                # 更新通知状态
                log.status = 'sent' if result else 'failed'
                if result:
                    success_count += 1
                else:
                    fail_count += 1
            
            # 提交所有更改
            db.session.commit()
            
            current_app.logger.info(f"重发通知完成: 成功={success_count}, 失败={fail_count}")
            return success_count, fail_count
        except Exception as e:
            current_app.logger.error(f"重发通知异常: {str(e)}")
            import traceback
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return 0, 0