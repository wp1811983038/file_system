# app/api/enforcer.py
from flask import jsonify, request, current_app, url_for
from app.models.message import Message
from app.models.user import User
from app.models.user_file import UserFile
from app.models.file_template import FileTemplate
from app.models.inspection import Inspection
from app.models.inspection_problem import InspectionProblem
from app.models.inspection_photo import InspectionPhoto
from app import db
from app.utils.auth import token_required, enforcer_required
from . import bp_enforcer as bp
from datetime import datetime
import os
import traceback
from werkzeug.utils import secure_filename
from app.services.message_service import MessageService

# 执法端首页统计数据
@bp.route('/dashboard', methods=['GET'])
@token_required
@enforcer_required
def get_dashboard(current_user):
    """获取执法人员首页统计数据"""
    try:
        # 获取企业总数
        company_count = User.query.filter_by(role='user').count()
        
        # 获取待检查任务数
        pending_count = Inspection.query.filter_by(
            enforcer_id=current_user.id,
            status='pending'
        ).count()
        
        # 获取已完成检查任务数
        completed_count = Inspection.query.filter_by(
            enforcer_id=current_user.id,
            status='completed'
        ).count()
        
        # 计算提交总数
        submission_count = pending_count + completed_count
        
        # 计算审批通过数（检查中没有问题的检查）
        approved_count = db.session.query(Inspection).filter(
            Inspection.enforcer_id == current_user.id,
            Inspection.status == 'completed',
            ~Inspection.id.in_(
                db.session.query(InspectionProblem.inspection_id).distinct()
            )
        ).count()
        
        # 计算合规率
        compliance_rate = round((approved_count / submission_count * 100) if submission_count > 0 else 0, 1)
        
        return jsonify({
            'company_count': company_count,
            'pending_count': pending_count,
            'completed_count': completed_count,
            'submission_count': submission_count,
            'approved_count': approved_count,
            'compliance_rate': compliance_rate
        })
    except Exception as e:
        current_app.logger.error(f"获取执法人员首页数据失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取企业列表
@bp.route('/companies', methods=['GET'])
@token_required
@enforcer_required
def get_companies(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        keyword = request.args.get('keyword', '')
        
        # 查询普通企业用户
        query = User.query.filter_by(is_admin=False).filter(User.role == 'user')
        
        # 应用搜索条件
        if keyword:
            query = query.filter(db.or_(
                User.username.ilike(f'%{keyword}%'),
                User.company_name.ilike(f'%{keyword}%'),
                User.company_address.ilike(f'%{keyword}%'),
                User.industry.ilike(f'%{keyword}%')
            ))
        
        # 统计总数
        total = query.count()
        
        # 分页
        companies = query.paginate(page=page, per_page=limit, error_out=False)
        
        # 准备响应数据
        result = []
        for company in companies.items:
            result.append({
                'id': company.id,
                'username': company.username,
                'company_name': company.company_name,
                'contact_info': company.contact_info,
                'company_address': company.company_address,
                'industry': company.industry,
                'recruitment_unit': company.recruitment_unit
            })
        
        return jsonify({
            'companies': result,
            'total': total
        })
    except Exception as e:
        current_app.logger.error(f"获取企业列表失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取企业详情
@bp.route('/companies/<int:company_id>', methods=['GET'])
@token_required
@enforcer_required
def get_company_detail(current_user, company_id):
    try:
        # 查询企业用户
        company = User.query.filter_by(id=company_id, role='user').first_or_404()
        
        # 准备响应数据
        result = {
            'id': company.id,
            'username': company.username,
            'company_name': company.company_name,
            'contact_info': company.contact_info,
            'company_address': company.company_address,
            'industry': company.industry,
            'recruitment_unit': company.recruitment_unit
        }
        
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"获取企业详情失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取企业文件
@bp.route('/companies/<int:company_id>/files', methods=['GET'])
@token_required
@enforcer_required
def get_company_files(current_user, company_id):
    try:
        # 查询企业提交的文件
        files = UserFile.query.filter_by(user_id=company_id).all()
        
        # 准备响应数据
        result = []
        for file in files:
            # 获取模板信息
            template = FileTemplate.query.get(file.template_id)
            
            result.append({
                'id': file.id,
                'filename': file.filename,
                'template_id': file.template_id,
                'template_name': template.name if template else '未知模板',
                'upload_date': file.upload_date.strftime('%Y-%m-%d %H:%M:%S') if file.upload_date else None,
                'status': file.status
            })
        
        return jsonify({
            'files': result
        })
    except Exception as e:
        current_app.logger.error(f"获取企业文件失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 创建检查任务
@bp.route('/inspections/create', methods=['POST'])
@token_required
@enforcer_required
def create_inspection(current_user):
    try:
        data = request.get_json()
        
        # 验证必要字段
        if not all(key in data for key in ['company_id', 'inspection_type', 'planned_date', 'description']):
            return jsonify({'error': '缺少必要参数'}), 400
        
        # 处理日期和时间
        planned_date_str = data['planned_date']
        planned_time_str = data.get('planned_time', '00:00')  # 默认时间为00:00
        
        try:
            # 如果提供了完整日期时间
            if 'planned_datetime' in data:
                planned_datetime = datetime.strptime(data['planned_datetime'], '%Y-%m-%d %H:%M')
            else:
                # 否则组合日期和时间
                planned_datetime = datetime.strptime(f"{planned_date_str} {planned_time_str}", '%Y-%m-%d %H:%M')
        except ValueError:
            return jsonify({'error': '日期时间格式无效'}), 400
        
        # 获取企业信息
        company = User.query.get(data['company_id'])
        company_name = company.company_name if company else "未知企业"
        
        # 创建检查任务
        inspection = Inspection(
            enforcer_id=current_user.id,
            company_id=data['company_id'],
            inspection_type=data['inspection_type'],
            planned_date=planned_datetime,  # 使用包含时间的日期时间对象
            description=data['description'],
            basis=data.get('basis', ''),
            status='pending',
            created_at=datetime.utcnow()
        )
        
        db.session.add(inspection)
        db.session.commit()
        
        # 通知管理员和企业（如果需要）
        try:
            # 获取所有管理员
            admins = User.query.filter_by(is_admin=True).all()
            
            # 创建通知内容
            notification_content = f"执法人员 {current_user.username} 创建了针对企业 {company_name} 的检查任务，"
            notification_content += f"计划检查时间为 {planned_date_str}。"
            notification_content += f"\n检查类型：{data['inspection_type']}"
            notification_content += f"\n检查内容：{data['description']}"
            if data.get('basis'):
                notification_content += f"\n检查依据：{data.get('basis')}"
            
            # 给管理员发送通知
            for admin in admins:
                MessageService.create_inspection_message(
                    user_id=admin.id,
                    title="新检查任务通知",
                    content=notification_content,
                    inspection_id=inspection.id
                )
            
            # 如果需要通知企业
            if data.get('notify_company', False):
                # 发送通知给企业
                company_notification = f"执法部门将于 {planned_date_str} 对您的企业进行{data['inspection_type']}，请做好准备。"
                company_notification += f"\n检查内容：{data['description']}"
                
                MessageService.create_inspection_message(
                    user_id=data['company_id'],
                    title="检查通知",
                    content=company_notification,
                    inspection_id=inspection.id
                )
        except Exception as e:
            current_app.logger.error(f"发送检查通知失败: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            # 通知发送失败不影响检查任务创建
        
        return jsonify({
            'message': '检查任务创建成功',
            'inspection_id': inspection.id
        }), 201
    except Exception as e:
        current_app.logger.error(f"创建检查任务失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# 获取检查任务列表
@bp.route('/inspections', methods=['GET'])
@token_required
@enforcer_required
def get_inspections(current_user):
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        status = request.args.get('status', '')
        company_id = request.args.get('company_id')
        keyword = request.args.get('keyword', '')
        
        # 构建查询
        query = Inspection.query.filter_by(enforcer_id=current_user.id)
        
        # 过滤状态
        if status:
            query = query.filter_by(status=status)
        
        # 过滤企业
        if company_id:
            query = query.filter_by(company_id=company_id)
        
        # 关键词搜索（企业名称）
        if keyword:
            query = query.join(User, Inspection.company_id == User.id) \
                        .filter(User.company_name.ilike(f'%{keyword}%'))
        
        # 按创建时间倒序排序
        query = query.order_by(Inspection.created_at.desc())
        
        # 统计总数
        total = query.count()
        
        # 分页
        inspections = query.paginate(page=page, per_page=limit, error_out=False)
        
        # 准备响应数据
        result = []
        for insp in inspections.items:
            result.append({
                'id': insp.id,
                'company_id': insp.company_id,
                'company_name': insp.company.company_name,
                'inspection_type': insp.inspection_type,
                'planned_date': insp.planned_date.strftime('%Y-%m-%d') if insp.planned_date else None,
                'description': insp.description,
                'status': insp.status,
                'created_at': insp.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'completed_time': insp.completed_at.strftime('%Y-%m-%d %H:%M:%S') if insp.completed_at else None,
                'problem_count': insp.problems.count(),
                'photo_count': insp.photos.count()
            })
        
        return jsonify({
            'inspections': result,
            'total': total
        })
    except Exception as e:
        current_app.logger.error(f"获取检查任务列表失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取检查任务详情
@bp.route('/inspections/<int:inspection_id>', methods=['GET'])
@token_required
@enforcer_required
def get_inspection_detail(current_user, inspection_id):
    try:
        # 查询检查任务
        inspection = Inspection.query.filter_by(
            id=inspection_id, 
            enforcer_id=current_user.id
        ).first_or_404()
        
        # 获取问题列表
        problems = []
        for problem in inspection.problems:
            problems.append({
                'id': problem.id,
                'type': problem.type,
                'severity': problem.severity,
                'description': problem.description
            })
        
        # 获取照片列表
        photos = []
        for photo in inspection.photos:
            photos.append({
                'id': photo.id,
                'photo_url': photo.photo_url,
                'description': photo.description
            })
        
        # 准备响应数据
        result = {
            'inspection': inspection.to_dict(),
            'company': {
                'id': inspection.company.id,
                'company_name': inspection.company.company_name,
                'contact_info': inspection.company.contact_info,
                'company_address': inspection.company.company_address
            },
            'problems': problems,
            'photos': photos
        }
        
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"获取检查任务详情失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 获取待执行检查任务
@bp.route('/inspections/pending', methods=['GET'])
@token_required
@enforcer_required
def get_pending_inspections(current_user):
    try:
        # 获取当前日期
        today = datetime.now().date()
        
        # 查询今天或之前的待执行检查任务
        inspections = Inspection.query.filter(
            Inspection.enforcer_id == current_user.id,
            Inspection.status == 'pending',
            Inspection.planned_date <= today
        ).order_by(Inspection.planned_date).all()
        
        # 准备响应数据
        result = []
        for insp in inspections:
            result.append({
                'id': insp.id,
                'company_id': insp.company_id,
                'company_name': insp.company.company_name,
                'company_address': insp.company.company_address,
                'inspection_type': insp.inspection_type,
                'planned_time': insp.planned_date.strftime('%Y-%m-%d') if insp.planned_date else None,
                'description': insp.description
            })
        
        return jsonify({
            'inspections': result
        })
    except Exception as e:
        current_app.logger.error(f"获取待执行检查任务失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 上传文件（照片）
@bp.route('/upload', methods=['POST'])
@token_required
@enforcer_required
def upload_file(current_user):
    try:
        # 检查是否有文件
        if 'file' not in request.files:
            return jsonify({'error': '未选择文件'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '未选择文件'}), 400
        
        # 检查文件类型
        file_type = request.form.get('file_type', 'inspection_photo')
        
        # 生成安全的文件名
        original_filename = file.filename
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"{timestamp}_{secure_filename(original_filename)}"
        
        # 确定保存路径
        save_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'enforcer', str(current_user.id))
        os.makedirs(save_dir, exist_ok=True)
        
        file_path = os.path.join(save_dir, filename)
        
        # 保存文件
        file.save(file_path)
        
        # 生成访问URL
        file_url = url_for('static', 
                          filename=f'uploads/enforcer/{current_user.id}/{filename}', 
                          _external=True)
        
        return jsonify({
            'message': '文件上传成功',
            'file_path': file_path,
            'file_url': file_url
        })
    except Exception as e:
        current_app.logger.error(f"上传文件失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# 提交检查结果
@bp.route('/inspections/<int:inspection_id>/complete', methods=['POST'])
@token_required
@enforcer_required
def complete_inspection(current_user, inspection_id):
    try:
        # 查询检查任务
        inspection = Inspection.query.filter_by(
            id=inspection_id, 
            enforcer_id=current_user.id
        ).first_or_404()
        
        # 检查状态
        if inspection.status == 'completed':
            return jsonify({'error': '此检查任务已完成'}), 400
        
        data = request.get_json()
        
        # 保存问题记录
        if 'problems' in data and isinstance(data['problems'], list):
            # 先删除已有的问题记录
            InspectionProblem.query.filter_by(inspection_id=inspection_id).delete()
            
            # 添加新的问题记录
            for problem_data in data['problems']:
                problem = InspectionProblem(
                    inspection_id=inspection_id,
                    type=problem_data.get('type', ''),
                    severity=problem_data.get('severity', 'medium'),
                    description=problem_data.get('description', '')
                )
                db.session.add(problem)
        
        # 保存照片记录
        if 'photos' in data and isinstance(data['photos'], list):
            # 先删除已有的照片记录
            InspectionPhoto.query.filter_by(inspection_id=inspection_id).delete()
            
            # 添加新的照片记录
            for photo_data in data['photos']:
                photo = InspectionPhoto(
                    inspection_id=inspection_id,
                    photo_url=photo_data.get('photo_url', ''),
                    description=photo_data.get('description', '')
                )
                db.session.add(photo)
        
        # 更新检查任务状态
        inspection.status = 'completed'
        inspection.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        # 发送通知
        try:
            # 获取所有管理员
            admins = User.query.filter_by(is_admin=True).all()
            
            # 生成通知内容
            problem_count = InspectionProblem.query.filter_by(inspection_id=inspection_id).count()
            photo_count = InspectionPhoto.query.filter_by(inspection_id=inspection_id).count()
            
            notification_content = f"执法人员 {current_user.username} 已完成对企业 {inspection.company.company_name} 的检查。"
            notification_content += f"\n发现问题 {problem_count} 项，上传照片 {photo_count} 张。"
            
            # 给管理员发送通知
            for admin in admins:
                MessageService.create_inspection_message(
                user_id=admin.id,
                title="检查结果通知",
                content=notification_content,
                inspection_id=inspection_id  # 传入检查ID
            )
            
            # 给企业发送通知
            MessageService.create_inspection_message(
                user_id=inspection.company_id,
                title="检查结果通知",
                content=f"执法人员已完成对贵企业的检查，共记录 {problem_count} 项问题，请注意整改。",
                inspection_id=inspection_id
            )
        except Exception as e:
            current_app.logger.error(f"发送检查结果通知失败: {str(e)}")
            # 通知发送失败不影响检查任务提交
        
        return jsonify({
            'message': '检查结果提交成功'
        })
    except Exception as e:
        current_app.logger.error(f"提交检查结果失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    


@bp.route('/inspections/<int:inspection_id>', methods=['DELETE'])
@token_required
@enforcer_required
def delete_inspection(current_user, inspection_id):
    """删除待执行的检查任务"""
    try:
        # 查询检查任务
        inspection = Inspection.query.filter_by(
            id=inspection_id, 
            enforcer_id=current_user.id
        ).first_or_404()
        
        # 检查状态 - 只允许删除待执行的检查
        if inspection.status != 'pending':
            return jsonify({'error': '只能删除待执行的检查任务'}), 400
            
        # 删除关联的照片和问题记录
        InspectionPhoto.query.filter_by(inspection_id=inspection_id).delete()
        InspectionProblem.query.filter_by(inspection_id=inspection_id).delete()
        
        # 删除检查任务
        db.session.delete(inspection)
        db.session.commit()
        
        return jsonify({'message': '检查任务已删除'})
    except Exception as e:
        current_app.logger.error(f"删除检查任务失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 500