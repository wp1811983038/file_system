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
            contact_info='13800138000',
            # 新增字段
            company_address='测试地址123号',
            industry='测试行业',
            recruitment_unit='测试单位'
        )
        test_user.set_password('test123')
        db.session.add(test_user)
        
        # 添加示例企业数据
        enterprise1 = User(
            username='温杰',
            is_admin=False,
            company_name='平顶山平煤机煤矿机械装备有限公司',
            contact_info='17698266996',
            company_address='凤祥大道东段路北',
            industry='液压支架',
            recruitment_unit='招商局'
        )
        enterprise1.set_password('123456')
        db.session.add(enterprise1)
        
        enterprise2 = User(
            username='叶元明',
            is_admin=False,
            company_name='河南英通科技股份有限公司',
            contact_info='18638077777',
            company_address='龙山大道与兴业路交叉口东南角',
            industry='液压支架',
            recruitment_unit='桃花乡'
        )
        enterprise2.set_password('123456')
        db.session.add(enterprise2)
        
        enterprise3 = User(
            username='杨国营',
            is_admin=False,
            company_name='河南煤神新能源有限公司',
            contact_info='18603751177',
            company_address='龙山大道与郑州路西南300米路西',
            industry='矿用设备',
            recruitment_unit='蒙头镇'
        )
        enterprise3.set_password('123456')
        db.session.add(enterprise3)
        
        # 添加测试模板数据
        test_template = FileTemplate(
            name="测试模板",
            description="示例模板",
            file_path="/templates/demo.docx",
            # 确保模板字段完整
            filename="demo.docx",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.session.add(test_template)
        
        try:
            db.session.commit()
            print('数据库初始化成功！')
            print('创建了管理员账号：admin/admin123')
            print('创建了测试用户：test/test123')
            print('创建了3个企业用户，密码均为：123456')
        except Exception as e:
            db.session.rollback()
            print(f'错误：{str(e)}')

if __name__ == '__main__':
    init_db()