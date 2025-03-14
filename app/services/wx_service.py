# app/services/wx_service.py
import requests
import json
from datetime import datetime
from flask import current_app
from app import db
from app.models.user import User
from app.models.wx_subscription import WxSubscription
from app.models.wx_notification_log import WxNotificationLog

class WxService:
    """微信服务助手类"""
    
    @staticmethod
    def get_access_token():
        """获取微信接口调用凭证"""
        app_id = current_app.config['WX_APP_ID']
        app_secret = current_app.config['WX_APP_SECRET']
        url = f"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={app_id}&secret={app_secret}"
        
        response = requests.get(url)
        data = response.json()
        
        if 'access_token' in data:
            current_app.logger.info(f"获取access_token成功")
            return data['access_token']
        else:
            current_app.logger.error(f"获取access_token失败: {data}")
            return None
    
    @staticmethod
    def code2session(code):
        """通过临时登录凭证获取openid和session_key"""
        app_id = current_app.config['WX_APP_ID']
        app_secret = current_app.config['WX_APP_SECRET']
        
        url = f"https://api.weixin.qq.com/sns/jscode2session?appid={app_id}&secret={app_secret}&js_code={code}&grant_type=authorization_code"
        
        response = requests.get(url)
        result = response.json()
        
        if 'openid' in result:
            current_app.logger.info(f"code2session成功，获取到openid")
            return result
        else:
            current_app.logger.error(f"code2session失败: {result}")
            return None
    
    @staticmethod
    def send_subscription_message(openid, template_id, data, page=None):
        """发送订阅消息"""
        access_token = WxService.get_access_token()
        if not access_token:
            current_app.logger.error("获取access_token失败，无法发送订阅消息")
            return False
        
        url = f"https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token={access_token}"
        
        message_data = {
            "touser": openid,
            "template_id": template_id,
            "data": data
        }
        
        if page:
            message_data["page"] = page
        
        response = requests.post(url, json=message_data)
        result = response.json()
        
        if result.get('errcode') == 0:
            current_app.logger.info(f"发送订阅消息成功: openid={openid}, template_id={template_id}")
            return True
        else:
            current_app.logger.error(f"发送订阅消息失败: {result}, openid={openid}, template_id={template_id}")
            return False