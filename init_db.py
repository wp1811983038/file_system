from app import create_app, db
from app.models.user import User
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from datetime import datetime

app = create_app()

def init_db():
    with app.app_context():
        # 删除所有表
        db.drop_all()
        # 创建所有表
        db.create_all()
        
        # 创建管理员用户
        admin = User(
            username='admin',
            is_admin=True
        )
        admin.set_password('admin123')
        db.session.add(admin)
        
        # 创建测试用户
        test_user = User(
            username='test',
            is_admin=False,
            company_name='测试公司',
            contact_info='13800138000'
        )
        test_user.set_password('test123')
        db.session.add(test_user)
        
        # 添加测试模板数据
        test_template = FileTemplate(
            name="测试模板",
            description="示例模板",
            file_path="/templates/demo.docx"
        )
        db.session.add(test_template)
        
        try:
            db.session.commit()
            print('数据库初始化成功！')
        except Exception as e:
            db.session.rollback()
            print(f'错误：{str(e)}')

if __name__ == '__main__':
    init_db() 