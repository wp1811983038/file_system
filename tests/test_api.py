import unittest
import json
import os
import sys
import requests
from datetime import datetime
from werkzeug.datastructures import FileStorage, MultiDict

# 添加项目根目录到 Python 路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

# 现在可以导入 app 相关模块
from app.models.user import User
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from io import BytesIO

BASE_URL = 'http://127.0.0.1:5000/api/v1'

class APITester:
    def __init__(self):
        self.admin_token = None
        self.user_token = None
        self.test_file_path = os.path.join(current_dir, 'test.txt')
        self.template_id = None

    def setup(self):
        """创建测试文件"""
        with open(self.test_file_path, 'w') as f:
            f.write('This is a test file')

    def cleanup(self):
        """清理测试文件"""
        if os.path.exists(self.test_file_path):
            os.remove(self.test_file_path)

    def test_auth(self):
        """测试认证相关接口"""
        print("\n=== 测试认证模块 ===")
        
        # 1. 管理员登录
        print("\n1.1 测试管理员登录...")
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'username': 'admin',
            'password': 'admin123'
        })
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        self.admin_token = response.json()['token']

        # 2. 普通用户登录
        print("\n1.2 测试普通用户登录...")
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'username': 'test',
            'password': 'test123'
        })
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        self.user_token = response.json()['token']

        # 3. 测试无效登录
        print("\n1.3 测试无效登录...")
        response = requests.post(f'{BASE_URL}/auth/login', json={
            'username': 'invalid',
            'password': 'invalid'
        })
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

    def test_admin_functions(self):
        """测试管理员功能"""
        print("\n=== 测试管理员功能 ===")
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        user_headers = {'Authorization': f'Bearer {self.user_token}'}

        # 1. 获取统计数据
        print("\n2.1 测试获取统计数据...")
        response = requests.get(f'{BASE_URL}/admin/stats', headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 2. 测试普通用户访问管理员接口
        print("\n2.2 测试权限验证...")
        response = requests.get(f'{BASE_URL}/admin/stats', headers=user_headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 3. 获取用户列表
        print("\n2.3 测试获取用户列表...")
        response = requests.get(f'{BASE_URL}/admin/users', headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 4. 创建新用户
        print("\n2.4 测试创建新用户...")
        response = requests.post(f'{BASE_URL}/admin/users', 
            headers=headers,
            json={
                'username': f'test_user_{datetime.now().timestamp()}',
                'password': '123456',
                'company_name': 'Test Company',
                'contact_info': '13800138000'
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

    def test_file_operations(self):
        """测试文件操作"""
        print("\n=== 测试文件操作 ===")
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        user_headers = {'Authorization': f'Bearer {self.user_token}'}
        
        # 1. 上传模板
        print("\n3.1 测试上传模板...")
        with open(self.test_file_path, 'rb') as f:
            files = {'file': ('test.txt', f, 'text/plain')}
            data = MultiDict([
                ('name', f'Test Template {datetime.now()}'),
                ('description', 'Test Description')
            ])
            response = requests.post(
                f'{BASE_URL}/admin/templates',
                headers=admin_headers,
                files=files,
                data=data
            )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        if response.status_code == 201:
            self.template_id = response.json()['template']['id']
        else:
            print("❌ 模板上传失败，跳过后续测试")
            return

        # 2. 测试无效文件上传
        print("\n3.2 测试无效文件上传...")
        response = requests.post(
            f'{BASE_URL}/admin/templates',
            headers=admin_headers,
            data={'name': 'Invalid Template'}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 3. 获取模板列表
        print("\n3.3 测试获取模板列表...")
        response = requests.get(f'{BASE_URL}/admin/templates', headers=admin_headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 4. 用户提交文件
        print("\n3.4 测试用户提交文件...")
        with open(self.test_file_path, 'rb') as f:
            files = {'file': ('submission.txt', f, 'text/plain')}
            response = requests.post(
                f'{BASE_URL}/files/upload/{self.template_id}',
                headers=user_headers,
                files=files
            )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 5. 测试重复提交
        print("\n3.5 测试重复提交文件...")
        with open(self.test_file_path, 'rb') as f:
            files = {'file': ('submission.txt', f, 'text/plain')}
            response = requests.post(
                f'{BASE_URL}/files/upload/{self.template_id}',
                headers=user_headers,
                files=files
            )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 6. 获取提交列表
        print("\n3.6 测试获取提交列表...")
        response = requests.get(
            f'{BASE_URL}/admin/submissions',
            headers=admin_headers
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 7. 测试批量操作
        print("\n3.7 测试批量删除模板...")
        response = requests.post(
            f'{BASE_URL}/admin/templates/batch',
            headers=admin_headers,
            json={
                'operation': 'delete',
                'template_ids': [self.template_id]
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

    def test_user_functions(self):
        """测试用户功能"""
        print("\n=== 测试用户功能 ===")
        headers = {'Authorization': f'Bearer {self.user_token}'}

        # 1. 获取个人信息
        print("\n4.1 测试获取个人信息...")
        response = requests.get(f'{BASE_URL}/users/profile', headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 2. 更新个人信息
        print("\n4.2 测试更新个人信息...")
        response = requests.put(
            f'{BASE_URL}/users/profile',
            headers=headers,
            json={
                'company_name': 'Updated Company',
                'contact_info': '13900139000'
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

        # 3. 测试无效更新
        print("\n4.3 测试无效的个人信息更新...")
        response = requests.put(
            f'{BASE_URL}/users/profile',
            headers=headers,
            json={
                'invalid_field': 'invalid_value'
            }
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")

    def run_all_tests(self):
        """运行所有测试"""
        try:
            self.setup()
            self.test_auth()
            self.test_admin_functions()
            self.test_file_operations()
            self.test_user_functions()
        except Exception as e:
            print(f"\n❌ 测试过程中出现错误: {str(e)}")
        finally:
            self.cleanup()

if __name__ == '__main__':
    tester = APITester()
    tester.run_all_tests() 