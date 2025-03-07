from flask import jsonify, request, current_app
from app.models.user import User
from app.models.user_file import UserFile
from app.models.approval import FileApproval, ApprovalWorkflow, WorkflowStep
from app import db
from app.utils.auth import token_required, admin_required
from datetime import datetime
import traceback
from . import bp_approvals as bp

@bp.route('/pending', methods=['GET'])
@token_required
def get_pending_approvals(current_user):
    """获取待审批的文件列表"""
    try:
        current_app.logger.info(f'获取待审批列表: user_id={current_user.id}')
        
        # 查询当前用户需要审批的文件
        pending_approvals = FileApproval.query.filter_by(
            approver_id=current_user.id,
            status='pending'
        ).join(UserFile).all()
        
        result = []
        for approval in pending_approvals:
            file = approval.file
            result.append({
                'approval_id': approval.id,
                'file_id': file.id,
                'filename': file.filename,
                'submitter': file.user.username if file.user else '未知',
                'template_name': file.template.name if file.template else "",
                'submitted_date': file.upload_date.strftime('%Y-%m-%d %H:%M:%S') if file.upload_date else ''
            })
        
        current_app.logger.info(f'待审批列表获取成功: count={len(result)}')
        return jsonify({'approvals': result})
        
    except Exception as e:
        current_app.logger.error(f"获取待审批列表失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@bp.route('/detail/<int:approval_id>', methods=['GET'])
@token_required
def get_approval_detail(current_user, approval_id):
    """获取审批详情"""
    try:
        approval = FileApproval.query.get_or_404(approval_id)
        
        # 检查权限
        if approval.approver_id != current_user.id and not current_user.is_admin:
            return jsonify({'error': '无权限查看此审批详情'}), 403
        
        file = approval.file
        
        result = {
            'approval_id': approval.id,
            'file_id': file.id,
            'filename': file.filename,
            'file_path': file.file_path,
            'submitter': {
                'id': file.user.id if file.user else None,
                'username': file.user.username if file.user else '未知',
                'company_name': file.user.company_name if file.user else None
            },
            'template': {
                'id': file.template.id if file.template else None,
                'name': file.template.name if file.template else '未知'
            },
            'status': approval.status,
            'comments': approval.comments,
            'submitted_date': file.upload_date.strftime('%Y-%m-%d %H:%M:%S') if file.upload_date else '',
            'approver': {
                'id': approval.approver.id if approval.approver else None,
                'username': approval.approver.username if approval.approver else '未知'
            }
        }
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"获取审批详情失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@bp.route('/<int:approval_id>', methods=['POST'])
@token_required
def process_approval(current_user, approval_id):
    """处理审批请求"""
    try:
        current_app.logger.info(f'开始处理审批: approval_id={approval_id}, user_id={current_user.id}')
        
        approval = FileApproval.query.get_or_404(approval_id)
        
        # 检查权限
        if approval.approver_id != current_user.id and not current_user.is_admin:
            current_app.logger.warning(f'权限不足: user_id={current_user.id}, approval_id={approval_id}')
            return jsonify({'error': '无权限处理此审批'}), 403
        
        # 获取请求数据
        data = request.get_json()
        decision = data.get('decision')
        comments = data.get('comments', '')
        
        if decision not in ['approved', 'rejected']:
            current_app.logger.warning(f'无效的审批决定: decision={decision}')
            return jsonify({'error': '无效的审批决定'}), 400
        
        # 更新审批记录
        approval.status = decision
        approval.comments = comments
        approval.approval_date = datetime.utcnow()
        
        file = UserFile.query.get(approval.file_id)
        
        if decision == 'approved':
            # 检查是否有下一步审批
            workflow = ApprovalWorkflow.query.get(file.workflow_id)
            next_step = WorkflowStep.query.filter_by(
                workflow_id=workflow.id, 
                step_order=file.current_approval_step + 1
            ).first()
            
            if next_step:
                # 有下一步审批
                file.current_approval_step += 1
                file.status = 'under_review'
                
                # 创建下一个审批任务
                approver_id = None
                if next_step.approver_type == 'user':
                    approver_id = next_step.approver_id
                else:
                    # 根据角色查找审批人
                    approvers = User.query.filter_by(is_admin=True).all()
                    if approvers:
                        approver_id = approvers[0].id
                
                if approver_id:
                    next_approval = FileApproval(
                        file_id=file.id,
                        approver_id=approver_id,
                        status='pending'
                    )
                    db.session.add(next_approval)
            else:
                # 最后一步，审批完成
                file.status = 'approved'
        else:
            # 拒绝则直接结束审批流程
            file.status = 'rejected'
        
        db.session.commit()
        
        current_app.logger.info(f'审批处理成功: approval_id={approval.id}, decision={decision}, file_status={file.status}')
        
        return jsonify({
            'message': '审批处理成功',
            'status': approval.status,
            'file_status': file.status
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"处理审批失败: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500