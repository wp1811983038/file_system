import os
import sys
import requests
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = 'http://127.0.0.1:5000/api/v1'

def test_apis():
    # 1. 登录获取 token
    print("\n1. Testing login...")
    response = requests.post(f'{BASE_URL}/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    print(f"Login response: {response.json()}")
    token = response.json()['token']
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # 2. 获取统计数据
    print("\n2. Testing stats...")
    response = requests.get(f'{BASE_URL}/admin/stats', headers=headers)
    print(f"Stats response: {response.json()}")
    
    # 3. 获取用户列表
    print("\n3. Testing users list...")
    response = requests.get(f'{BASE_URL}/admin/users', headers=headers)
    print(f"Users response: {response.json()}")
    
    # 4. 获取模板列表
    print("\n4. Testing templates list...")
    response = requests.get(f'{BASE_URL}/admin/templates', headers=headers)
    print(f"Templates response: {response.json()}")

if __name__ == '__main__':
    test_apis()