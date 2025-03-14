from flask import jsonify, request, current_app  # 添加 current_app 的导入
from app.models.user import User
from app import db
from app.utils.auth import token_required
from . import bp_user as bp
import traceback

# 用户相关的API路由 

@bp.route('/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'company_name': current_user.company_name,
        'contact_info': current_user.contact_info,
        'company_address': current_user.company_address,
        'industry': current_user.industry,
        'recruitment_unit': current_user.recruitment_unit,
        'is_admin': current_user.is_admin
    })


import re

def validate_phone_number(phone):
    """验证手机号是否有效"""
    # 中国大陆手机号正则表达式验证
    pattern = r'^1[3-9]\d{9}$'
    return re.match(pattern, phone) is not None


@bp.route('/profile', methods=['PUT'])
@token_required
def update_profile(current_user):
    current_app.logger.info(f'开始处理更新用户信息请求: user_id={current_user.id}')
    data = request.get_json()
    try:
        # 处理用户名
        if 'username' in data:
            # 检查新用户名是否已存在
            existing_user = User.query.filter(
                User.username == data['username'],
                User.id != current_user.id
            ).first()
            if existing_user:
                current_app.logger.warning(f'用户名已存在: {data["username"]}')
                return jsonify({'error': '用户名已存在'}), 400
                
            current_app.logger.info(f'更新用户名: {current_user.username} -> {data["username"]}')
            current_user.username = data['username']
            
        # 处理公司名称
        if 'company_name' in data:
            current_app.logger.info(f'更新公司名称: {current_user.company_name} -> {data["company_name"]}')
            current_user.company_name = data['company_name']
            
        # 处理联系方式（包含验证）
        if 'contact_info' in data:
            # 添加手机号验证
            if data['contact_info'] and not validate_phone_number(data['contact_info']):
                current_app.logger.warning(f'无效的手机号: {data["contact_info"]}')
                return jsonify({'error': '请输入有效的手机号码'}), 400
                
            current_app.logger.info(f'更新联系方式: {current_user.contact_info} -> {data["contact_info"]}')
            current_user.contact_info = data['contact_info']
        
        # 处理新增字段 - 企业地址
        if 'company_address' in data:
            current_app.logger.info(f'更新企业地址: {current_user.company_address} -> {data["company_address"]}')
            current_user.company_address = data['company_address']
        
        # 处理新增字段 - 所属行业
        if 'industry' in data:
            current_app.logger.info(f'更新所属行业: {current_user.industry} -> {data["industry"]}')
            current_user.industry = data['industry']
        
        # 处理新增字段 - 招商单位
        if 'recruitment_unit' in data:
            current_app.logger.info(f'更新招商单位: {current_user.recruitment_unit} -> {data["recruitment_unit"]}')
            current_user.recruitment_unit = data['recruitment_unit']
            
        # 提交数据库更改
        db.session.commit()
        current_app.logger.info('用户信息更新成功')
        
        # 返回完整的用户信息
        return jsonify({
            'message': '个人信息更新成功',
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'company_name': current_user.company_name,
                'contact_info': current_user.contact_info,
                'company_address': current_user.company_address,
                'industry': current_user.industry,
                'recruitment_unit': current_user.recruitment_unit,
                'is_admin': current_user.is_admin
            }
        })
    except Exception as e:
        current_app.logger.error(f'更新用户信息失败: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    
@bp.route('/change-password', methods=['POST'])
@token_required
def change_password(current_user):
    """修改密码"""
    try:
        current_app.logger.info(f'开始处理修改密码请求: user_id={current_user.id}')
        data = request.get_json()
        
        current_app.logger.info('验证当前密码')
        if not current_user.check_password(data['old_password']):
            current_app.logger.warning('当前密码验证失败')
            return jsonify({'error': '当前密码错误'}), 400
            
        current_app.logger.info('设置新密码')
        current_user.set_password(data['new_password'])
        db.session.commit()
        
        current_app.logger.info('密码修改成功')
        return jsonify({'message': '密码修改成功'})
    except Exception as e:
        current_app.logger.error(f'修改密码失败: {str(e)}')
        current_app.logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    


from app.models.wx_subscription import WxSubscription

@bp.route('/subscribe', methods=['POST'])
@token_required
def update_subscription(current_user):
    """更新用户订阅状态"""
    data = request.get_json()
    
    if not current_user.openid:
        return jsonify({'error': '用户未绑定微信openid'}), 400
        
    # 检查用户是否已有订阅记录
    subscription = WxSubscription.query.filter_by(user_id=current_user.id).first()
    
    if not subscription:
        # 创建新记录
        subscription = WxSubscription(
            user_id=current_user.id,
            openid=current_user.openid,
            file_receive_status=data.get('fileReceiveStatus', 'reject'),
            file_process_status=data.get('fileProcessStatus', 'reject')
        )
        db.session.add(subscription)
    else:
        # 更新现有记录
        if 'fileReceiveStatus' in data:
            subscription.file_receive_status = data['fileReceiveStatus']
        if 'fileProcessStatus' in data:
            subscription.file_process_status = data['fileProcessStatus']
    
    db.session.commit()
    return jsonify({'message': '订阅状态已更新'})

@bp.route('/subscribe', methods=['GET'])
@token_required
def get_subscription_status(current_user):
    """获取用户当前的订阅状态"""
    subscription = WxSubscription.query.filter_by(user_id=current_user.id).first()
    
    if not subscription:
        return jsonify({
            'hasOpenid': bool(current_user.openid),
            'fileReceiveStatus': 'reject',
            'fileProcessStatus': 'reject'
        })
    
    return jsonify({
        'hasOpenid': bool(current_user.openid),
        'fileReceiveStatus': subscription.file_receive_status,
        'fileProcessStatus': subscription.file_process_status
    })