from flask import request, jsonify, make_response
import hashlib
from . import bp_auth as bp
from flask import current_app
import xml.etree.ElementTree as ET

@bp.route('/wx/callback', methods=['GET', 'POST'])
def wx_callback():
    """处理微信服务器验证和消息推送"""
    if request.method == 'GET':
        # 处理服务器验证
        signature = request.args.get('signature', '')
        timestamp = request.args.get('timestamp', '')
        nonce = request.args.get('nonce', '')
        echostr = request.args.get('echostr', '')
        
        # 记录日志便于调试
        current_app.logger.info(f"微信验证请求: signature={signature}, timestamp={timestamp}, nonce={nonce}")
        
        # 获取配置的token
        token = current_app.config.get('WX_TOKEN')
        
        # 按照微信的规则进行签名验证
        temp_list = [token, timestamp, nonce]
        temp_list.sort()
        temp_str = ''.join(temp_list)
        
        # 进行sha1签名
        sign = hashlib.sha1(temp_str.encode('utf-8')).hexdigest()
        
        # 记录计算的签名用于调试
        current_app.logger.info(f"计算的签名: {sign}")
        
        # 验证签名
        if sign == signature:
            return echostr
        else:
            current_app.logger.warning(f"签名验证失败: 期望={signature}, 计算={sign}")
            return 'signature verification failed'
    
    elif request.method == 'POST':
        # 处理微信推送的消息
        current_app.logger.info("收到微信消息推送")
        
        # 简单回复
        reply = "<xml><ToUserName><![CDATA[%s]]></ToUserName><FromUserName><![CDATA[%s]]></FromUserName><CreateTime>%s</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[%s]]></Content></xml>"
        
        response = make_response()
        response.content_type = 'application/xml'
        response.data = reply % ('微信用户', '公众号', str(int(time.time())), '收到消息')
        return response