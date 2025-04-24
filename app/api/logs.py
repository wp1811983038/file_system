# app/api/logs.py
import os
import csv
import json
import traceback
from datetime import datetime, timedelta
from flask import jsonify, request, current_app, send_file
from app.models.operation_log import OperationLog
from app.models.user import User
from app.models.file_template import FileTemplate
from app import db
from app.utils.auth import token_required, admin_required
from . import bp_logs as bp
import pandas as pd
import tempfile
import zipfile
from sqlalchemy import and_, or_

# 获取日志列表
@bp.route('', methods=['GET'])
@token_required
@admin_required
def get_logs(current_user):
    """获取操作日志列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # 处理筛选条件
        log_type = request.args.get('type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        user_id = request.args.get('user_id')  # 统一的用户ID参数
        role = request.args.get('role')  # 角色参数
        
        # 构建查询
        query = OperationLog.query
        
        # 类型筛选
        if log_type and log_type != 'all':
            query = query.filter(OperationLog.type == log_type)
        
        # 日期筛选
        if start_date:
            start_datetime = datetime.strptime(f"{start_date} 00:00:00", "%Y-%m-%d %H:%M:%S")
            query = query.filter(OperationLog.operate_time >= start_datetime)
        
        if end_date:
            end_datetime = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(OperationLog.operate_time <= end_datetime)
        
        # 用户筛选 - 查询与指定用户相关的所有日志
        if user_id:
            user_id = int(user_id)
            # 查询用户作为操作人或被操作用户的所有日志
            query = query.filter(or_(
                OperationLog.operator_id == user_id,
                OperationLog.target_user_id == user_id
            ))
        
        # 角色筛选 - 查询指定角色相关的所有日志
        if role:
            # 查询指定角色的所有用户ID
            role_users = User.query.filter_by(role=role).all()
            if role_users:
                role_user_ids = [user.id for user in role_users]
                # 查询该角色用户作为操作人或被操作用户的所有日志
                query = query.filter(or_(
                    OperationLog.operator_id.in_(role_user_ids),
                    OperationLog.target_user_id.in_(role_user_ids)
                ))
            else:
                # 没有匹配的用户，返回空结果
                return jsonify({
                    'logs': [],
                    'total': 0,
                    'page': page,
                    'pages': 0
                })
        
        # 按时间倒序排序
        query = query.order_by(OperationLog.operate_time.desc())
        
        # 计算总数和总页数
        total = query.count()
        total_pages = (total + per_page - 1) // per_page  # 向上取整
        
        # 分页
        logs = query.limit(per_page).offset((page - 1) * per_page).all()
        
        # 准备响应数据
        logs_data = []
        for log in logs:
            log_dict = log.to_dict(include_users=False)
            
            # 添加操作人显示名称
            if log.operator:
                log_dict['operator'] = log.operator.username
                log_dict['operator_company'] = log.operator.company_name
                log_dict['operator_phone'] = mask_phone_number(log.operator.contact_info)
            else:
                log_dict['operator'] = '未知用户'
                log_dict['operator_company'] = ''
                log_dict['operator_phone'] = ''
            
            # 添加目标用户显示名称
            if log.target_user:
                log_dict['target_user'] = log.target_user.username
                log_dict['target_company'] = log.target_user.company_name
                log_dict['target_phone'] = mask_phone_number(log.target_user.contact_info)
            else:
                log_dict['target_user'] = ''
                log_dict['target_company'] = ''
                log_dict['target_phone'] = ''
            
            logs_data.append(log_dict)
        
        return jsonify({
            'logs': logs_data,
            'total': total,
            'page': page,
            'pages': total_pages
        })
    except Exception as e:
        current_app.logger.error(f"获取操作日志失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 导出日志
@bp.route('/export', methods=['POST'])
@token_required
@admin_required
def export_logs(current_user):
    """导出操作日志"""
    try:
        data = request.get_json()
        
        # 获取导出参数
        export_format = data.get('format', 'xlsx')
        fields = data.get('fields', '').split(',') if data.get('fields') else []
        
        # 筛选条件
        log_type = data.get('type')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        operator = data.get('operator')
        target_user = data.get('target_user')
        include_template_files = data.get('include_template_files', False)
        
        # 验证必要参数
        if not fields:
            return jsonify({'error': '导出字段不能为空'}), 400
        
        # 构建查询
        query = OperationLog.query
        
        # 类型筛选
        if log_type and log_type != 'all':
            query = query.filter(OperationLog.type == log_type)
        
        # 日期筛选
        if start_date:
            start_datetime = datetime.strptime(f"{start_date} 00:00:00", "%Y-%m-%d %H:%M:%S")
            query = query.filter(OperationLog.operate_time >= start_datetime)
        
        if end_date:
            end_datetime = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(OperationLog.operate_time <= end_datetime)
        
        # 用户筛选
        if operator:
            # 根据用户名查找用户ID
            operator_users = User.query.filter(User.username.ilike(f"%{operator}%")).all()
            if operator_users:
                operator_ids = [user.id for user in operator_users]
                query = query.filter(OperationLog.operator_id.in_(operator_ids))
            else:
                # 没有匹配的用户，创建空的导出文件
                return create_empty_export(export_format, fields)
        
        if target_user:
            # 根据用户名查找用户ID
            target_users = User.query.filter(User.username.ilike(f"%{target_user}%")).all()
            if target_users:
                target_ids = [user.id for user in target_users]
                query = query.filter(OperationLog.target_user_id.in_(target_ids))
            else:
                # 没有匹配的用户，创建空的导出文件
                return create_empty_export(export_format, fields)
        
        # 按时间倒序排序
        query = query.order_by(OperationLog.operate_time.desc())
        
        # 执行查询
        logs = query.all()
        
        # 处理导出
        if export_format == 'xlsx':
            return export_logs_to_excel(logs, fields, include_template_files)
        else:
            return export_logs_to_csv(logs, fields)
    except Exception as e:
        current_app.logger.error(f"导出操作日志失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 导出为Excel
def export_logs_to_excel(logs, fields, include_template_files=False):
    """导出日志为Excel格式"""
    try:
        # 准备导出数据
        export_data = []
        template_files = []
        
        for log in logs:
            log_dict = {}
            
            # 收集字段数据
            for field in fields:
                if field == 'type':
                    log_dict['操作类型'] = get_log_type_text(log.type)
                elif field == 'operate_time':
                    log_dict['操作时间'] = log.operate_time.strftime('%Y-%m-%d %H:%M:%S')
                elif field == 'operator':
                    log_dict['执行人'] = log.operator.username if log.operator else '未知用户'
                elif field == 'operator_company':
                    log_dict['执行人公司'] = log.operator.company_name if log.operator else ''
                elif field == 'operator_phone':
                    log_dict['执行人手机号'] = mask_phone_number(log.operator.contact_info) if log.operator else ''
                elif field == 'content':
                    log_dict['操作内容'] = log.content
                elif field == 'target_user':
                    log_dict['相关用户'] = log.target_user.username if log.target_user else ''
                elif field == 'target_company':
                    log_dict['相关公司'] = log.target_user.company_name if log.target_user else ''
                elif field == 'target_phone':
                    log_dict['相关用户手机号'] = mask_phone_number(log.target_user.contact_info) if log.target_user else ''
                elif field == 'status':
                    log_dict['状态'] = get_log_status_text(log.status)
                elif field == 'remarks':
                    log_dict['备注'] = log.remarks or ''
            
            export_data.append(log_dict)
            
            # 收集模板文件
            if include_template_files and log.type == 'template' and log.related_id:
                try:
                    template = FileTemplate.query.get(log.related_id)
                    if template and template.file_path and os.path.exists(template.file_path):
                        template_files.append((template.filename, template.file_path))
                except Exception as e:
                    current_app.logger.error(f"获取模板文件失败: {str(e)}")
        
        # 创建Excel文件
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        file_name = f"操作日志_{timestamp}.xlsx"
        
        if include_template_files and template_files:
            # 创建包含模板文件的压缩包
            zip_path = os.path.join(tempfile.gettempdir(), f"操作日志_{timestamp}.zip")
            
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                # 创建并添加Excel文件
                excel_path = os.path.join(tempfile.gettempdir(), file_name)
                df = pd.DataFrame(export_data)
                df.to_excel(excel_path, index=False)
                zipf.write(excel_path, file_name)
                
                # 添加模板文件
                for filename, filepath in template_files:
                    zipf.write(filepath, os.path.join('templates', filename))
            
            # 发送压缩包文件
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=f"操作日志和模板文件_{timestamp}.zip",
                mimetype='application/zip'
            )
        else:
            # 只导出Excel文件
            excel_path = os.path.join(tempfile.gettempdir(), file_name)
            df = pd.DataFrame(export_data)
            df.to_excel(excel_path, index=False)
            
            # 发送Excel文件
            return send_file(
                excel_path,
                as_attachment=True,
                download_name=file_name,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
    except Exception as e:
        current_app.logger.error(f"导出Excel失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 导出为CSV
def export_logs_to_csv(logs, fields):
    """导出日志为CSV格式"""
    try:
        # 创建临时CSV文件
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        file_name = f"操作日志_{timestamp}.csv"
        csv_path = os.path.join(tempfile.gettempdir(), file_name)
        
        with open(csv_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
            # 准备表头
            fieldnames = []
            for field in fields:
                if field == 'type':
                    fieldnames.append('操作类型')
                elif field == 'operate_time':
                    fieldnames.append('操作时间')
                elif field == 'operator':
                    fieldnames.append('执行人')
                elif field == 'operator_company':
                    fieldnames.append('执行人公司')
                elif field == 'operator_phone':
                    fieldnames.append('执行人手机号')
                elif field == 'content':
                    fieldnames.append('操作内容')
                elif field == 'target_user':
                    fieldnames.append('相关用户')
                elif field == 'target_company':
                    fieldnames.append('相关公司')
                elif field == 'target_phone':
                    fieldnames.append('相关用户手机号')
                elif field == 'status':
                    fieldnames.append('状态')
                elif field == 'remarks':
                    fieldnames.append('备注')
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            # 写入数据
            for log in logs:
                row = {}
                
                for field in fields:
                    if field == 'type':
                        row['操作类型'] = get_log_type_text(log.type)
                    elif field == 'operate_time':
                        row['操作时间'] = log.operate_time.strftime('%Y-%m-%d %H:%M:%S')
                    elif field == 'operator':
                        row['执行人'] = log.operator.username if log.operator else '未知用户'
                    elif field == 'operator_company':
                        row['执行人公司'] = log.operator.company_name if log.operator else ''
                    elif field == 'operator_phone':
                        row['执行人手机号'] = mask_phone_number(log.operator.contact_info) if log.operator else ''
                    elif field == 'content':
                        row['操作内容'] = log.content
                    elif field == 'target_user':
                        row['相关用户'] = log.target_user.username if log.target_user else ''
                    elif field == 'target_company':
                        row['相关公司'] = log.target_user.company_name if log.target_user else ''
                    elif field == 'target_phone':
                        row['相关用户手机号'] = mask_phone_number(log.target_user.contact_info) if log.target_user else ''
                    elif field == 'status':
                        row['状态'] = get_log_status_text(log.status)
                    elif field == 'remarks':
                        row['备注'] = log.remarks or ''
                
                writer.writerow(row)
        
        # 发送CSV文件
        return send_file(
            csv_path,
            as_attachment=True,
            download_name=file_name,
            mimetype='text/csv'
        )
    except Exception as e:
        current_app.logger.error(f"导出CSV失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 创建空的导出文件
def create_empty_export(export_format, fields):
    """创建空的导出文件"""
    try:
        # 准备表头
        fieldnames = []
        for field in fields:
            if field == 'type':
                fieldnames.append('操作类型')
            elif field == 'operate_time':
                fieldnames.append('操作时间')
            elif field == 'operator':
                fieldnames.append('执行人')
            elif field == 'operator_company':
                fieldnames.append('执行人公司')
            elif field == 'operator_phone':
                fieldnames.append('执行人手机号')
            elif field == 'content':
                fieldnames.append('操作内容')
            elif field == 'target_user':
                fieldnames.append('相关用户')
            elif field == 'target_company':
                fieldnames.append('相关公司')
            elif field == 'target_phone':
                fieldnames.append('相关用户手机号')
            elif field == 'status':
                fieldnames.append('状态')
            elif field == 'remarks':
                fieldnames.append('备注')
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        if export_format == 'xlsx':
            # 创建空的Excel文件
            file_name = f"操作日志_{timestamp}.xlsx"
            excel_path = os.path.join(tempfile.gettempdir(), file_name)
            
            df = pd.DataFrame(columns=fieldnames)
            df.to_excel(excel_path, index=False)
            
            return send_file(
                excel_path,
                as_attachment=True,
                download_name=file_name,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            # 创建空的CSV文件
            file_name = f"操作日志_{timestamp}.csv"
            csv_path = os.path.join(tempfile.gettempdir(), file_name)
            
            with open(csv_path, 'w', newline='', encoding='utf-8-sig') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
            
            return send_file(
                csv_path,
                as_attachment=True,
                download_name=file_name,
                mimetype='text/csv'
            )
    except Exception as e:
        current_app.logger.error(f"创建空导出文件失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 工具函数
def get_log_type_text(log_type):
    """获取日志类型的显示文本"""
    type_mapping = {
        'system_notice': '系统通知',
        'template': '模板管理',
        'submission': '文件提交',
        'approval': '审批记录',
        'inspection': '执法检查',
        'feedback': '问题反馈'
    }
    return type_mapping.get(log_type, log_type)

def get_log_status_text(status):
    """获取日志状态的显示文本"""
    status_mapping = {
        'success': '成功',
        'pending': '待处理',
        'rejected': '已拒绝',
        'processing': '处理中',
        'approved': '已通过'
    }
    return status_mapping.get(status, status)

def mask_phone_number(phone):
    """加密手机号中间部分"""
    if not phone:
        return ''
    
    phone = str(phone)
    if len(phone) >= 11:
        return phone[:3] + '****' + phone[-4:]
    elif len(phone) > 6:
        return phone[:3] + '****' + phone[-2:]
    else:
        return phone