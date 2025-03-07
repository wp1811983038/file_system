from flask import jsonify, request, send_file
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from app.utils.auth import token_required
from . import bp_files as bp
from app.utils.admin import admin_required
from werkzeug.utils import secure_filename
import os
from app import db
from flask import current_app
from app.models.user import User
from app.utils.file import allowed_file
from datetime import datetime
from flask import url_for
import urllib.parse  # 添加这行
import traceback    # 添加这行

@bp.route('/user/templates', methods=['GET'])
@token_required
def get_user_templates(current_user):
    try:
        templates = FileTemplate.query.filter_by(is_active=True).all()
        user_submissions = {
            uf.template_id: uf 
            for uf in UserFile.query.filter_by(user_id=current_user.id).all()
        }
        
        response_templates = []
        for template in templates:
            submission = user_submissions.get(template.id)
            template_data = {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'filename': template.filename,
                'status': bool(submission),
                'submission_id': submission.id if submission else None,  # 添加这行
                'upload_date': template.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            response_templates.append(template_data)
            
        return jsonify({
            'templates': response_templates
        })
    except Exception as e:
        current_app.logger.error(f"获取模板列表失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/user_files', methods=['GET'])
@token_required
def get_user_files(current_user):
    user_files = UserFile.query.filter_by(user_id=current_user.id).all()
    return jsonify({
        'files': [{
            'id': f.id,
            'template_name': f.template.name,
            'filename': f.filename,
            'upload_date': f.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
            'status': f.status
        } for f in user_files]
    })

# 修改 files.py 中的 upload_file 函数

@bp.route('/upload/<int:template_id>', methods=['POST'])
@token_required
def upload_file(current_user, template_id):
    try:
        current_app.logger.info(f'开始处理文件上传请求: template_id={template_id}, user_id={current_user.id}')
        
        # 检查模板是否存在
        template = FileTemplate.query.get_or_404(template_id)
        current_app.logger.info(f'找到模板: id={template.id}, name={template.name}')
        
        if 'file' not in request.files:
            current_app.logger.error('未选择文件')
            return jsonify({'error': '未选择文件'}), 400
            
        file = request.files['file']
        if file.filename == '':
            current_app.logger.error('未选择文件')
            return jsonify({'error': '未选择文件'}), 400

        # 获取原始文件名 - 修改这里，尝试从多个来源获取真实的文件名
        # 优先顺序：URL参数 > 表单字段 > HTTP头 > 文件名
        original_filename = (
            request.args.get('originalName') or 
            request.form.get('originalFilename') or
            request.form.get('original_filename') or
            request.form.get('filename') or
            request.headers.get('X-Original-Filename') or
            os.path.basename(file.filename)
        )

        current_app.logger.info(f'原始文件名: {original_filename}')
        
        # 生成新的存储文件名：用户ID_模板ID.扩展名
        file_extension = os.path.splitext(original_filename)[1]  # 获取文件扩展名
        storage_filename = f"{current_user.id}_{template_id}{file_extension}"
        current_app.logger.info(f'存储文件名: {storage_filename}')
        
        # 保存文件
        save_dir = os.path.join(current_app.config['USER_FILES_FOLDER'], str(current_user.id))
        os.makedirs(save_dir, exist_ok=True)
        current_app.logger.info(f'保存目录: {save_dir}')
        
        file_path = os.path.join(save_dir, storage_filename)
        current_app.logger.info(f'文件将保存到: {file_path}')
        
        # 查找是否存在旧文件记录
        old_file = UserFile.query.filter_by(
            user_id=current_user.id,
            template_id=template_id
        ).first()
        
        # 直接保存文件（会覆盖同名文件）
        file.save(file_path)
        current_app.logger.info('文件保存成功')
        
        # 更新数据库记录 - 使用上面获取的原始文件名
        if old_file:
            current_app.logger.info('更新现有文件记录')
            old_file.file_path = file_path
            old_file.filename = original_filename  # 使用真实原始文件名
            old_file.update_time = datetime.utcnow()
        else:
            current_app.logger.info('创建新的文件记录')
            user_file = UserFile(
                user_id=current_user.id,
                template_id=template_id,
                file_path=file_path,
                filename=original_filename  # 使用真实原始文件名
            )
            db.session.add(user_file)
            
        db.session.commit()
        current_app.logger.info('数据库记录已更新')
        
        return jsonify({
            'message': '上传成功',
            'filename': original_filename  # 返回真实原始文件名
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'文件上传失败: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': '文件上传失败'}), 400
    

# 添加模板批量操作的路由
@bp.route('/api/v1/admin/templates/batch', methods=['POST'])
@token_required
@admin_required
def batch_templates(current_user):
    """批量操作模板"""
    try:
        data = request.get_json()
        operation = data.get('operation')
        template_ids = data.get('template_ids', [])
        
        if not template_ids:
            return jsonify({'error': '未指定模板'}), 400
            
        if operation == 'delete':
            for template_id in template_ids:
                template = FileTemplate.query.get(template_id)
                if template:
                    # 删除物理文件
                    if template.file_path and os.path.exists(template.file_path):
                        os.remove(template.file_path)
                    # 删除数据库记录
                    db.session.delete(template)
            
            db.session.commit()
            return jsonify({'message': '删除成功'})
        else:
            return jsonify({'error': '不支持的操作'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500



@bp.route('/preview/submission/<int:user_id>/<int:template_id>')
@token_required
def preview_submission(current_user, user_id, template_id):
    try:
        current_app.logger.info(f'开始处理文件预览请求: user_id={user_id}, template_id={template_id}')
        
        # 查找提交记录
        user_file = UserFile.query.filter_by(
            user_id=user_id,
            template_id=template_id
        ).first_or_404()
        
        # 检查权限
        if not current_user.is_admin and user_file.user_id != current_user.id:
            return jsonify({'error': '无权限访问此文件'}), 403
            
        if not os.path.exists(user_file.file_path):
            current_app.logger.error(f'文件不存在: {user_file.file_path}')
            return jsonify({'error': '文件已不存在'}), 404
            
        current_app.logger.info(f'找到文件记录: filename={user_file.filename}, file_path={user_file.file_path}')
        
        # 从文件名获取扩展名
        file_extension = os.path.splitext(user_file.filename)[1].lower()
        current_app.logger.info(f'从原始文件名获取扩展名: {file_extension}')
        
        mime_types = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
        }
        
        mimetype = mime_types.get(file_extension, 'application/octet-stream')
        current_app.logger.info(f'文件类型: extension={file_extension}, mimetype={mimetype}')
        
        encoded_filename = urllib.parse.quote(user_file.filename)
        current_app.logger.info(f'文件名编码: 原始文件名={user_file.filename}, 编码后={encoded_filename}')
        
        try:
            response = send_file(
                user_file.file_path,
                as_attachment=False,
                mimetype=mimetype,
                download_name=user_file.filename
            )
            
            if mimetype.startswith(('text/', 'image/', 'video/', 'audio/')):
                response.headers["Content-Disposition"] = f"inline; filename*=UTF-8''{encoded_filename}"
            else:
                response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{encoded_filename}"
            
            current_app.logger.info('文件预览响应已生成')
            current_app.logger.info(f'响应头: {dict(response.headers)}')
            
            return response
            
        except Exception as e:
            current_app.logger.error(f'生成文件预览失败: {str(e)}')
            return jsonify({'error': '预览失败'}), 500
            
    except Exception as e:
        current_app.logger.error(f'预览处理过程中出错: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': '预览失败'}), 500

@bp.route('/download/submission/<int:user_id>/<int:template_id>')
@token_required
def download_submission(current_user, user_id, template_id):
    try:
        current_app.logger.info(f'开始处理文件下载请求: user_id={user_id}, template_id={template_id}')
        
        # 查找提交记录
        user_file = UserFile.query.filter_by(
            user_id=user_id,
            template_id=template_id
        ).first_or_404()
        
        # 检查权限
        if not current_user.is_admin and user_file.user_id != current_user.id:
            return jsonify({'error': '无权限访问此文件'}), 403
            
        if not os.path.exists(user_file.file_path):
            current_app.logger.error(f'文件不存在: {user_file.file_path}')
            return jsonify({'error': '文件已不存在'}), 404
            
        filename = user_file.filename
        encoded_filename = urllib.parse.quote(filename)
        
        current_app.logger.info(f'准备下载文件: 原始文件名={filename}, 编码后={encoded_filename}')
        
        response = send_file(
            user_file.file_path,
            as_attachment=True,
            download_name=filename
        )
        
        response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{encoded_filename}"
        
        current_app.logger.info(f'设置响应头完成')
        
        return response
        
    except Exception as e:
        current_app.logger.error(f'下载文件时出错: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@bp.route('/templates/<int:template_id>/status')
@token_required
def get_template_status(current_user, template_id):
    """获取模板的提交状态统计"""
    try:
        template = FileTemplate.query.get_or_404(template_id)
        
        # 获取所有非管理员用户
        all_users = User.query.filter_by(is_admin=False).all()
        
        # 获取该模板的所有提交记录
        submissions = UserFile.query.filter_by(template_id=template_id).all()
        submitted_user_ids = [sub.user_id for sub in submissions]
        
        # 区分已提交和未提交用户
        submitted_users = []
        pending_users = []
        
        for user in all_users:
            if user.id in submitted_user_ids:
                # 获取该用户的提交记录
                submission = next(sub for sub in submissions if sub.user_id == user.id)
                submitted_users.append({
                    'user_id': user.id,
                    'username': user.username,
                    'company_name': user.company_name,
                    'contact_info': user.contact_info,
                    'template_id': template_id,  # 添加模板ID
                    'submission': {
                        'id': submission.id,
                        'template_id': template_id,  # 添加到 submission 对象中
                        'filename': submission.filename,
                        'upload_date': submission.upload_date.strftime('%Y-%m-%d %H:%M:%S')
                    }
                })
            else:
                pending_users.append({
                    'user_id': user.id,
                    'username': user.username,
                    'company_name': user.company_name,
                    'contact_info': user.contact_info
                })
        
        return jsonify({
            'template_id': template_id,
            'template_name': template.name,
            'total_users': len(all_users),
            'submitted_count': len(submitted_users),
            'submissions': submitted_users,
            'pending_users': pending_users
        })
    except Exception as e:
        current_app.logger.error(f"获取模板状态失败: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/search', methods=['GET'])
@token_required
def search_files(current_user):
    """搜索文件"""
    keyword = request.args.get('keyword', '')
    file_type = request.args.get('type', 'all')  # template 或 submission
    
    try:
        if file_type == 'template':
            results = FileTemplate.query.filter(
                db.or_(
                    FileTemplate.name.ilike(f'%{keyword}%'),
                    FileTemplate.description.ilike(f'%{keyword}%')
                )
            ).all()
            
            return jsonify({
                'templates': [{
                    'id': t.id,
                    'name': t.name,
                    'description': t.description,
                    'upload_date': t.upload_date.strftime('%Y-%m-%d %H:%M:%S')
                } for t in results]
            })
            
        elif file_type == 'submission':
            # 普通用户只能搜索自己的提交
            query = UserFile.query
            if not current_user.is_admin:
                query = query.filter_by(user_id=current_user.id)
                
            results = query.filter(
                db.or_(
                    UserFile.filename.ilike(f'%{keyword}%'),
                    FileTemplate.name.ilike(f'%{keyword}%')
                )
            ).join(FileTemplate).all()
            
            return jsonify({
                'submissions': [{
                    'id': f.id,
                    'filename': f.filename,
                    'template_name': f.template.name,
                    'upload_date': f.upload_date.strftime('%Y-%m-%d %H:%M:%S'),
                    'status': f.status
                } for f in results]
            })
            
        else:
            return jsonify({'error': '无效的搜索类型'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500 
    


@bp.route('/download/template/<int:template_id>')
@token_required
def download_template(current_user, template_id):
    """下载模板文件"""
    try:
        template = FileTemplate.query.get_or_404(template_id)
        if not os.path.exists(template.file_path):
            return jsonify({'error': '文件不存在'}), 404
            
        # 获取文件扩展名
        _, file_extension = os.path.splitext(template.filename)
        
        # 构建下载文件名：模板名称 + 原文件扩展名
        download_name = f"{template.name}{file_extension}"
        
        # 设置响应头，确保正确的文件名编码
        response = send_file(
            template.file_path,
            as_attachment=True,
            download_name=download_name
        )
        
        return response
    except Exception as e:
        current_app.logger.error(f"下载失败: {str(e)}")
        return jsonify({'error': '下载失败'}), 500

# 修改下载模板的路由
# @bp.route('/api/v1/download/template/<int:template_id>')
# @token_required
# def download_template_api(current_user, template_id):
#     """API: 下载模板文件"""
#     try:
#         template = FileTemplate.query.get_or_404(template_id)
#         if not os.path.exists(template.file_path):
#             return jsonify({'error': '文件不存在'}), 404
            
#         return send_file(
#             template.file_path,
#             as_attachment=True,
#             download_name=template.filename
#         )
#     except Exception as e:
#         current_app.logger.error(f"下载失败: {str(e)}")
#         return jsonify({'error': '下载失败'}), 500




# 审批
@bp.route('/submit/<int:file_id>', methods=['POST'])
@token_required
def submit_file_for_approval(current_user, file_id):
    """提交文件进入审批流程"""
    try:
        current_app.logger.info(f'开始处理文件提交审批请求: file_id={file_id}, user_id={current_user.id}')
        
        file = UserFile.query.get_or_404(file_id)
        
        # 检查权限
        if file.user_id != current_user.id and not current_user.is_admin:
            current_app.logger.warning(f'权限不足: user_id={current_user.id}, file_id={file_id}')
            return jsonify({'error': '无权限操作此文件'}), 403
        
        # 检查文件是否已提交
        if file.status != 'draft':
            current_app.logger.warning(f'文件状态错误: file_id={file_id}, status={file.status}')
            return jsonify({'error': '文件已经提交，无法重复提交'}), 400
        
        # 获取审批流程
        workflow = None
        if file.workflow_id:
            workflow = ApprovalWorkflow.query.get(file.workflow_id)
        elif file.template and file.template.workflow_id:
            workflow = ApprovalWorkflow.query.get(file.template.workflow_id)
        
        if not workflow:
            current_app.logger.warning(f'未找到审批流程: file_id={file_id}')
            return jsonify({'error': '未找到审批流程配置'}), 400
        
        # 更新文件状态
        file.status = 'submitted'
        file.workflow_id = workflow.id
        file.current_approval_step = 1
        
        # 创建第一个审批任务
        first_step = WorkflowStep.query.filter_by(
            workflow_id=workflow.id, 
            step_order=1
        ).first()
        
        if not first_step:
            current_app.logger.error(f'审批流程配置错误: workflow_id={workflow.id}')
            return jsonify({'error': '审批流程配置错误'}), 400
        
        # 确定审批人
        approver_id = None
        if first_step.approver_type == 'user':
            approver_id = first_step.approver_id
        else:
            # 根据角色查找审批人
            approvers = User.query.filter_by(is_admin=True).all()
            if approvers:
                approver_id = approvers[0].id
        
        if not approver_id:
            current_app.logger.error(f'未找到合适的审批人: workflow_id={workflow.id}, step_order=1')
            return jsonify({'error': '未找到合适的审批人'}), 400
        
        # 创建审批记录
        approval = FileApproval(
            file_id=file.id,
            approver_id=approver_id,
            status='pending'
        )
        
        db.session.add(approval)
        db.session.commit()
        
        current_app.logger.info(f'文件提交审批成功: file_id={file.id}, status={file.status}')
        
        return jsonify({
            'message': '文件已提交审批',
            'file_id': file.id,
            'status': file.status
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"提交审批失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@bp.route('/files/<int:file_id>/approval-progress', methods=['GET'])
@token_required
def get_approval_progress(current_user, file_id):
    """获取文件审批进度"""
    try:
        file = UserFile.query.get_or_404(file_id)
        
        # 检查权限
        if file.user_id != current_user.id and not current_user.is_admin:
            return jsonify({'error': '无权限查看此文件审批进度'}), 403
        
        # 获取文件信息
        file_info = {
            'id': file.id,
            'filename': file.filename,
            'template_name': file.template.name if file.template else '',
            'upload_date': file.upload_date.strftime('%Y-%m-%d %H:%M:%S') if file.upload_date else '',
            'status': file.status,
            'current_step': file.current_approval_step
        }
        
        # 获取审批历史
        approvals = FileApproval.query.filter_by(file_id=file.id).order_by(FileApproval.created_at).all()
        approval_history = []
        
        for approval in approvals:
            approval_data = {
                'id': approval.id,
                'approver_id': approval.approver_id,
                'approver_name': approval.approver.username if approval.approver else '未知',
                'status': approval.status,
                'comments': approval.comments,
                'approval_date': approval.approval_date.strftime('%Y-%m-%d %H:%M:%S') if approval.approval_date else None
            }
            approval_history.append(approval_data)
        
        return jsonify({
            'file_info': file_info,
            'approval_history': approval_history
        })
        
    except Exception as e:
        current_app.logger.error(f"获取审批进度失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    


@bp.route('/<int:file_id>/approve', methods=['POST'])
@token_required
@admin_required
def approve_file(current_user, file_id):
    """管理员审批文件"""
    try:
        current_app.logger.info(f'开始处理文件审批请求: file_id={file_id}, admin_id={current_user.id}')
        
        # 获取文件信息
        file = UserFile.query.get_or_404(file_id)
        
        # 获取请求数据
        data = request.get_json()
        decision = data.get('decision')
        comments = data.get('comments', '')
        
        if decision not in ['approved', 'rejected']:
            current_app.logger.warning(f'无效的审批决定: decision={decision}')
            return jsonify({'error': '无效的审批决定', 'success': False}), 400
        
        # 查找现有审批记录，如果没有则创建新的
        approval = FileApproval.query.filter_by(
            file_id=file.id,
            approver_id=current_user.id,
        ).first()
        
        if not approval:
            approval = FileApproval(
                file_id=file.id,
                approver_id=current_user.id,
                status='pending'
            )
            db.session.add(approval)
        
        # 更新审批记录
        approval.status = decision
        approval.comments = comments
        approval.approval_date = datetime.utcnow()
        
        # 更新文件状态
        if decision == 'approved':
            file.status = 'approved'
        else:
            file.status = 'rejected'
        
        db.session.commit()
        
        current_app.logger.info(f'文件审批成功: file_id={file.id}, decision={decision}, status={file.status}')
        
        return jsonify({
            'message': '审批成功',
            'status': file.status,
            'success': True
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"审批文件失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'success': False}), 500