# app/api/enforcer.py
from flask import jsonify, request, current_app
from app.models.user import User
from app.models.user_file import UserFile
from app.models.file_template import FileTemplate
from app import db
from app.utils.auth import token_required, enforcer_required
from . import bp_enforcer as bp
import traceback

# 获取执法人员首页统计数据
@bp.route('/dashboard', methods=['GET'])
@token_required
@enforcer_required
def get_dashboard(current_user):
    """获取执法人员首页统计数据"""
    try:
        # 获取企业数量
        company_count = User.query.filter_by(role='user').count()
        
        # 获取模板总数
        template_count = FileTemplate.query.count()
        
        # 获取提交文件总数
        submission_count = UserFile.query.count()
        
        # 计算合规率 (已批准的文件占比)
        approved_count = UserFile.query.filter_by(status='approved').count()
        compliance_rate = round((approved_count / submission_count * 100) if submission_count > 0 else 0, 1)
        
        return jsonify({
            'company_count': company_count,
            'template_count': template_count,
            'submission_count': submission_count,
            'approved_count': approved_count,
            'compliance_rate': compliance_rate
        })
    except Exception as e:
        current_app.logger.error(f"获取执法人员首页数据失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取执法人员的个人信息
@bp.route('/profile', methods=['GET'])
@token_required
@enforcer_required
def get_profile(current_user):
    """获取执法人员的个人信息"""
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'company_name': current_user.company_name,
        'contact_info': current_user.contact_info,
        'role': current_user.role,
        'avatar_url': current_user.avatar_url,
        'created_at': current_user.created_at.strftime('%Y-%m-%d %H:%M:%S') if current_user.created_at else None
    })