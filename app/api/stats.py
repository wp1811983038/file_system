# app/api/stats.py
from flask import jsonify, request, current_app
from app.models.user_file import UserFile
from app.models.file_approval import FileApproval
from app.models.file_template import FileTemplate
from app import db
from app.utils.auth import token_required
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from . import bp_stats as bp
import traceback

# 获取用户提交文件总数
@bp.route('/submissions/count', methods=['GET'])
@token_required
def get_submission_count(current_user):
    try:
        count = UserFile.query.filter_by(user_id=current_user.id).count()
        
        return jsonify({
            'count': count
        })
    except Exception as e:
        current_app.logger.error(f"获取提交统计失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 获取用户提交文件状态分布
@bp.route('/submissions/status', methods=['GET'])
@token_required
def get_submission_status(current_user):
    try:
        # 获取所有状态的文件数量
        result = db.session.query(
            UserFile.status, 
            func.count(UserFile.id)
        ).filter(
            UserFile.user_id == current_user.id
        ).group_by(
            UserFile.status
        ).all()
        
        # 初始化状态计数
        status_counts = {
            'pending': 0,
            'approved': 0,
            'rejected': 0
        }
        
        # 填充实际数据
        for status, count in result:
            if status in status_counts:
                status_counts[status] = count
        
        # 计算总数和百分比
        total = sum(status_counts.values())
        
        status_rates = {}
        for status, count in status_counts.items():
            status_rates[status] = round(count / total * 100, 1) if total > 0 else 0
        
        return jsonify({
            'total': total,
            'status_counts': status_counts,
            'status_rates': status_rates
        })
    except Exception as e:
        current_app.logger.error(f"获取状态统计失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取模板提交情况
@bp.route('/templates', methods=['GET'])
@token_required
def get_template_stats(current_user):
    try:
        # 获取所有模板
        templates = FileTemplate.query.filter_by(is_active=True).all()
        
        # 查询用户已提交的模板
        submitted_templates = db.session.query(
            UserFile.template_id,
            UserFile.status
        ).filter(
            UserFile.user_id == current_user.id
        ).all()
        
        # 创建提交状态字典
        submission_status = {}
        for template_id, status in submitted_templates:
            submission_status[template_id] = status
        
        # 构建响应数据
        template_stats = []
        for template in templates:
            status = submission_status.get(template.id, None)
            
            template_stats.append({
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'has_submitted': status is not None,
                'status': status,
                'created_at': template.created_at.strftime('%Y-%m-%d %H:%M:%S') if template.created_at else None
            })
        
        # 按状态分类统计
        total_templates = len(templates)
        submitted_count = len([t for t in template_stats if t['has_submitted']])
        not_submitted_count = total_templates - submitted_count
        
        approved_count = len([t for t in template_stats if t.get('status') == 'approved'])
        rejected_count = len([t for t in template_stats if t.get('status') == 'rejected'])
        pending_count = len([t for t in template_stats if t.get('status') == 'pending'])
        
        return jsonify({
            'templates': template_stats,
            'summary': {
                'total': total_templates,
                'submitted': submitted_count,
                'not_submitted': not_submitted_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'pending': pending_count,
                'submission_rate': round(submitted_count / total_templates * 100, 1) if total_templates > 0 else 0
            }
        })
    except Exception as e:
        current_app.logger.error(f"获取模板统计失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取审批时效分析
@bp.route('/approval/efficiency', methods=['GET'])
@token_required
def get_approval_efficiency(current_user):
    try:
        # 查询已完成审批的文件信息
        approvals = db.session.query(
            UserFile,
            FileApproval
        ).join(
            FileApproval, 
            UserFile.id == FileApproval.file_id
        ).filter(
            UserFile.user_id == current_user.id,
            FileApproval.status.in_(['approved', 'rejected'])
        ).all()
        
        # 计算审批时效
        efficiency_data = []
        total_hours = 0
        
        for user_file, approval in approvals:
            # 计算提交到审批的时间差
            if approval.approval_date and user_file.upload_date:
                time_diff = approval.approval_date - user_file.upload_date
                hours = time_diff.total_seconds() / 3600  # 转换为小时
                total_hours += hours
                
                # 获取模板名称
                template_name = "未知模板"
                if user_file.template:
                    template_name = user_file.template.name
                
                efficiency_data.append({
                    'file_id': user_file.id,
                    'template_id': user_file.template_id,
                    'template_name': template_name,
                    'upload_date': user_file.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'approval_date': approval.approval_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'hours': round(hours, 1),
                    'status': approval.status
                })
        
        # 计算平均时效
        avg_hours = round(total_hours / len(approvals), 1) if approvals else 0
        
        # 按审批结果分类
        approved_files = [item for item in efficiency_data if item['status'] == 'approved']
        rejected_files = [item for item in efficiency_data if item['status'] == 'rejected']
        
        # 计算通过率
        approval_rate = round(len(approved_files) / len(approvals) * 100, 1) if approvals else 0
        
        return jsonify({
            'total_files': len(approvals),
            'average_hours': avg_hours,
            'approval_rate': approval_rate,
            'approved_count': len(approved_files),
            'rejected_count': len(rejected_files),
            'details': efficiency_data
        })
    except Exception as e:
        current_app.logger.error(f"获取审批时效分析失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500