# app/services/log_service.py
from app import db
from app.models.operation_log import OperationLog
from flask import current_app
import traceback
from datetime import datetime

class LogService:
    """操作日志服务类 - 封装记录操作日志的功能"""
    
    @staticmethod
    def create_log(type, operator_id, content, target_user_id=None, status='success', 
                   remarks=None, related_id=None, related_type=None):
        """创建操作日志
        
        Args:
            type: 操作类型，如 system_notice, template, submission, approval, inspection, feedback
            operator_id: 操作人ID
            content: 操作内容
            target_user_id: 被操作用户ID
            status: 操作状态，默认 success
            remarks: 备注
            related_id: 关联ID
            related_type: 关联类型
            
        Returns:
            返回创建的日志对象，失败则返回None
        """
        try:
            log = OperationLog(
                type=type,
                operator_id=operator_id,
                content=content,
                target_user_id=target_user_id,
                status=status,
                remarks=remarks,
                related_id=related_id,
                related_type=related_type,
                operate_time=datetime.utcnow()
            )
            
            db.session.add(log)
            db.session.commit()
            
            return log
        except Exception as e:
            current_app.logger.error(f"创建操作日志失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            db.session.rollback()
            return None
    
    @staticmethod
    def log_system_notice(operator_id, title, content, target_users=None):
        """记录系统通知日志"""
        log_content = f"发布系统通知: {title}"
        
        return LogService.create_log(
            type='system_notice',
            operator_id=operator_id,
            content=log_content,
            remarks=content,
            related_type='system_notice'
        )
    
    @staticmethod
    def log_template_operation(operator_id, operation, template_id, template_name):
        """记录模板操作日志"""
        operation_text = {
            'create': '创建',
            'update': '更新',
            'delete': '删除'
        }.get(operation, '操作')
        
        log_content = f"{operation_text}模板: {template_name}"
        
        return LogService.create_log(
            type='template',
            operator_id=operator_id,
            content=log_content,
            related_id=template_id,
            related_type='file_template'
        )
    
    @staticmethod
    def log_file_submission(user_id, template_id, template_name, filename):
        """记录文件提交日志"""
        log_content = f"提交文件: {filename} (模板: {template_name})"
        
        return LogService.create_log(
            type='submission',
            operator_id=user_id,
            content=log_content,
            related_id=template_id,
            related_type='user_file',
            status='pending'
        )
    
    @staticmethod
    def log_file_approval(admin_id, user_id, file_id, filename, status, comments=None):
        """记录文件审批日志"""
        status_text = '通过' if status == 'approved' else '拒绝'
        log_content = f"审批文件: {filename} - {status_text}"
        
        return LogService.create_log(
            type='approval',
            operator_id=admin_id,
            target_user_id=user_id,
            content=log_content,
            status=status,
            remarks=comments,
            related_id=file_id,
            related_type='user_file'
        )
    
    @staticmethod
    def log_inspection(enforcer_id, company_id, inspection_id, inspection_type, status):
        """记录执法检查日志"""
        status_text = {
            'pending': '计划',
            'completed': '完成',
            'deleted': '删除'  # 新增状态文本映射
        }.get(status, status)
        
        log_content = f"{status_text}{inspection_type}检查"
        
        return LogService.create_log(
            type='inspection',
            operator_id=enforcer_id,
            target_user_id=company_id,
            content=log_content,
            status=status,
            related_id=inspection_id,
            related_type='inspection'
        )
    
    @staticmethod
    def log_feedback(user_id, feedback_id, feedback_type, feedback_content, contact_info='', 
                    company_name='', images_count=0, admin_id=None, status=None, reply=None):
        """记录详细的问题反馈日志"""
        if admin_id:
            # 管理员回复
            status_text = {
                'processing': '处理中',
                'resolved': '已解决',
                'rejected': '已拒绝'
            }.get(status, status)
            
            log_content = f"回复问题反馈: {feedback_type} - {status_text}"
            detailed_remarks = f"回复内容: {reply or '无'}\n反馈内容: {feedback_content[:100]}..."
            
            return LogService.create_log(
                type='feedback',
                operator_id=admin_id,
                target_user_id=user_id,
                content=log_content,
                status=status,
                remarks=detailed_remarks,
                related_id=feedback_id,
                related_type='feedback'
            )
        else:
            # 用户提交
            log_content = f"提交问题反馈: {feedback_type}"
            
            # 构建详细信息
            detailed_remarks = (
                f"反馈详细内容: {feedback_content}\n"
                f"联系方式: {contact_info}\n"
                f"单位名称: {company_name}\n"
                f"附件图片数量: {images_count}张"
            )
            
            return LogService.create_log(
                type='feedback',
                operator_id=user_id,
                content=log_content,
                status='pending',
                remarks=detailed_remarks,
                related_id=feedback_id,
                related_type='feedback'
            )