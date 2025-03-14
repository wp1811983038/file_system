# wx_verify_test.py
import hashlib
import requests

# 配置信息
local_url = "http://localhost:5000/api/v1/auth/wx/callback"  # 本地API地址
token = "filesystem"  # 你在微信配置中使用的Token

# 生成测试参数
timestamp = "1234567890"
nonce = "random_nonce"
test_echostr = "test_echo_string"

# 按照微信的规则计算签名
temp_list = [token, timestamp, nonce]
temp_list.sort()
temp_str = ''.join(temp_list)
signature = hashlib.sha1(temp_str.encode('utf-8')).hexdigest()

# 构造请求URL
test_url = f"{local_url}?signature={signature}&timestamp={timestamp}&nonce={nonce}&echostr={test_echostr}"

print(f"测试URL: {test_url}")
print(f"预期签名: {signature}")

# 发送GET请求模拟微信验证
response = requests.get(test_url)

print(f"状态码: {response.status_code}")
print(f"响应内容: {response.text}")

# 验证响应是否成功
if response.text == test_echostr:
    print("✅ 验证成功！服务器正确返回了echostr")
else:
    print("❌ 验证失败！响应内容与echostr不匹配")