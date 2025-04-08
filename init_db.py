# init_db.py
import os
import re
import pandas as pd
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User
from app.models.settings import Settings
from app.models.file_template import FileTemplate
from app.models.user_file import UserFile
from app.models.file_approval import FileApproval
from config import Config

# 导入新增的执法端相关模型
# 注意：这些模型文件需要先创建好
from app.models.inspection import Inspection
from app.models.inspection_problem import InspectionProblem
from app.models.inspection_photo import InspectionPhoto

def create_admin_user():
    """创建系统管理员账户"""
    admin = User(
        username="admin",
        company_name="系统管理员",
        contact_info="13000000000",  # 管理员手机号
        role="admin",  # 设置角色为admin
        is_admin=True,
        created_at=datetime.now(),
        avatar_url=Config.DEFAULT_AVATAR  # 添加默认头像
    )
    admin.set_password("admin123")  # 设置管理员初始密码
    db.session.add(admin)
    print("创建系统管理员账户: admin (密码: admin123)")

    # 创建执法人员账户
    enforcer = User(
        username="enforcer",
        company_name="执法人员",
        contact_info="13100000000",
        role="enforcer",  # 设置角色为enforcer
        is_admin=False,
        created_at=datetime.now(),
        avatar_url=Config.DEFAULT_AVATAR
    )
    enforcer.set_password("enforcer123")
    db.session.add(enforcer)
    print("创建执法人员账户: enforcer (密码: enforcer123)")

def create_system_settings():
    """创建系统初始设置"""
    settings = Settings(
        system_name="郏县产业集聚区文件管理系统",
        system_description="欢迎使用文件管理系统，请按照要求提交您的文件。"
    )
    db.session.add(settings)
    print("创建系统初始设置")

def create_wx_subscription_tables():
    """在初始化数据库时，记录表信息"""
    print("微信订阅消息相关表将通过模型自动创建")
    print("- users表添加openid字段")
    print("- wx_subscriptions表：存储用户订阅状态")
    print("- wx_notification_logs表：记录通知发送历史")

def create_avatar_directories():
    """创建头像目录和默认头像"""
    # 创建头像目录
    os.makedirs(Config.AVATAR_FOLDER, exist_ok=True)
    print(f"创建头像目录: {Config.AVATAR_FOLDER}")
    
    # 创建默认头像目录
    default_avatar_dir = os.path.join(Config.BASE_DIR, 'app', 'static', 'images')
    os.makedirs(default_avatar_dir, exist_ok=True)
    print(f"创建默认头像目录: {default_avatar_dir}")
    
    # 检查默认头像文件是否存在
    default_avatar_path = os.path.join(default_avatar_dir, 'default-avatar.png')
    if not os.path.exists(default_avatar_path):
        print(f"注意: 默认头像文件不存在，请添加默认头像到: {default_avatar_path}")
        
        # 可以考虑添加一个创建简单默认头像的代码
        try:
            # 如果有PIL库，可以创建一个简单的默认头像
            from PIL import Image, ImageDraw
            
            # 创建一个200x200的灰色头像
            img = Image.new('RGB', (200, 200), color = (200, 200, 200))
            d = ImageDraw.Draw(img)
            
            # 画一个简单的轮廓
            d.ellipse((50, 50, 150, 150), fill=(150, 150, 150))
            
            # 保存为默认头像
            img.save(default_avatar_path)
            print(f"已创建简单的默认头像: {default_avatar_path}")
        except ImportError:
            print("未安装PIL库，无法自动创建默认头像")
            print("请手动添加一张名为'default-avatar.png'的图片到指定位置")

def create_inspection_models():
    """创建执法端相关的数据库表"""
    print("创建执法端相关数据库表:")
    print("- inspections表：存储检查任务信息")
    print("- inspection_problems表：存储检查问题记录")
    print("- inspection_photos表：存储检查照片记录")
    
    # 创建执法文件上传目录
    enforcer_upload_dir = os.path.join(Config.UPLOAD_FOLDER, 'enforcer')
    os.makedirs(enforcer_upload_dir, exist_ok=True)
    print(f"创建执法照片上传目录: {enforcer_upload_dir}")

def import_enterprises_from_excel(excel_file):
    """从Excel文件导入企业数据"""
    try:
        # 读取Excel文件
        df = pd.read_excel(excel_file)
        print(f"成功读取Excel文件，共{len(df)}条记录")
        
        # 1. 第一步：统计每个手机号对应的企业数量
        contact_count = {}  # 手机号 -> 企业数量
        for index, row in df.iterrows():
            phone = str(row.get('电话', '')).strip().replace(' ', '')
            phone = re.sub(r'\D', '', phone)  # 移除所有非数字字符
            
            if phone:
                contact_count[phone] = contact_count.get(phone, 0) + 1
        
        print("\n联系人分析:")
        print(f"总共有 {len(contact_count)} 个不同的联系人")
        multi_company_contacts = {k: v for k, v in contact_count.items() if v > 1}
        print(f"其中 {len(multi_company_contacts)} 个联系人管理多家企业")
        for phone, count in multi_company_contacts.items():
            print(f"  联系人 {phone} 管理 {count} 家企业")
        
        # 统计信息
        success_count = 0
        skip_count = 0
        error_count = 0
        
        # 跟踪已处理的联系人信息
        phone_mappings = {}  # 电话 -> [已分配的用户信息]
        username_mappings = {}  # 用户名基础 -> 计数
        
        # 用于记录导入的账号信息，后续生成Excel
        account_records = []
        
        # 2. 第二步：处理每一行数据
        for index, row in df.iterrows():
            try:
                # 提取数据，确保所有值都是字符串类型
                serial_no = str(row.get('序号', ''))
                enterprise_name = str(row.get('企业名称', '')).strip()
                contact_person = str(row.get('企业联系人', '')).strip()
                phone = str(row.get('电话', '')).strip().replace(' ', '')
                address = str(row.get('企业地址', '')).strip()
                industry = str(row.get('所属行业', '')).strip()
                recruitment_unit = str(row.get('招商单位', '')).strip()
                
                # 基本验证
                if not enterprise_name or not contact_person or not phone:
                    print(f"行 {index+2}: 企业名称、联系人或电话为空，跳过")
                    skip_count += 1
                    continue
                
                # 规范化手机号
                phone = re.sub(r'\D', '', phone)  # 移除所有非数字字符
                
                # 判断是否为多企业联系人
                is_multi_company = contact_count.get(phone, 0) > 1
                
                # 用户名生成策略
                if is_multi_company:
                    # 多企业联系人: 使用"联系人-企业名前缀"格式
                    base_username = f"{contact_person}-{enterprise_name[:5]}"
                else:
                    # 单企业联系人: 使用"联系人"名称作为用户名
                    base_username = contact_person
                
                # 确保用户名不重复
                if base_username in username_mappings:
                    username_mappings[base_username] += 1
                    username = f"{base_username}{username_mappings[base_username]}"
                else:
                    username_mappings[base_username] = 0
                    username = base_username
                
                # 确保该用户名未被使用
                while User.query.filter_by(username=username).first():
                    username_mappings[base_username] += 1
                    username = f"{base_username}{username_mappings[base_username]}"
                
                # 处理联系方式
                original_phone = phone  # 保存原始手机号用于设置密码
                login_phone = phone  # 用于登录的手机号
                
                # 如果是多企业联系人且不是第一次处理该手机号
                if is_multi_company and phone in phone_mappings:
                    # 该联系人的第N个企业，添加索引后缀
                    company_index = len(phone_mappings[phone]) + 1
                    contact_info = f"{phone}-{company_index}"
                    login_phone = f"{phone}-{company_index}"  # 登录用的手机号也要加后缀
                    phone_mappings[phone].append({
                        "username": username, 
                        "enterprise": enterprise_name, 
                        "login_phone": login_phone
                    })
                else:
                    # 该联系人的第一个企业或单企业联系人
                    contact_info = phone
                    if is_multi_company:
                        # 如果是多企业联系人的第一个企业，初始化记录
                        phone_mappings[phone] = [{
                            "username": username, 
                            "enterprise": enterprise_name,
                            "login_phone": login_phone
                        }]
                
                # 创建新用户
                user = User(
                    username=username,
                    company_name=enterprise_name,
                    contact_info=contact_info,  # 可能带有后缀
                    company_address=address,
                    industry=industry,
                    recruitment_unit=recruitment_unit,
                    is_admin=False,
                    role="user",  # 设置角色为普通用户
                    created_at=datetime.now(),
                    avatar_url=Config.DEFAULT_AVATAR  # 添加默认头像
                )
                
                # 设置密码为原始手机号
                user.set_password(original_phone)
                
                # 保存到数据库
                db.session.add(user)
                db.session.commit()
                
                print(f"行 {index+2}: 成功导入企业: {enterprise_name}")
                if is_multi_company:
                    print(f"  用户名: {username}，登录手机号: {login_phone}，初始密码: {original_phone}")
                else:
                    print(f"  用户名/登录手机号: {username}/{phone}，初始密码: {original_phone}")
                
                # 添加到账号记录，用于生成Excel
                account_records.append({
                    '序号': serial_no,
                    '企业名称': enterprise_name,
                    '联系人': contact_person,
                    '用户名': username,
                    '登录手机号': login_phone,
                    '初始密码': original_phone,
                    '所属行业': industry,
                    '招商单位': recruitment_unit,
                    '管理多企业': "是" if is_multi_company else "否"
                })
                
                success_count += 1
                
            except Exception as e:
                db.session.rollback()
                print(f"行 {index+2}: 导入失败: {str(e)}")
                error_count += 1
        
        # 输出多企业联系人信息
        if multi_company_contacts:
            print("\n多企业联系人登录方式汇总:")
            for phone, info_list in phone_mappings.items():
                if len(info_list) > 1:
                    print(f"\n联系电话: {phone} 管理的 {len(info_list)} 家企业:")
                    for i, info in enumerate(info_list, 1):
                        print(f"  {i}. 企业: {info['enterprise']}")
                        print(f"     用户名登录: {info['username']}")
                        print(f"     手机号登录: {info['login_phone']}")
                        print(f"     密码: {phone}")
        
        print("\n企业导入完成!")
        print(f"成功导入: {success_count}条")
        print(f"跳过: {skip_count}条")
        print(f"失败: {error_count}条")
        
        # 返回账号记录用于生成Excel
        return account_records
        
    except Exception as e:
        print(f"导入Excel文件出错: {str(e)}")
        return []

def generate_account_excel(account_records):
    """生成用户账号密码Excel文件"""
    if not account_records:
        print("没有账号记录，无法生成Excel")
        return False
    
    try:
        # 创建DataFrame
        df = pd.DataFrame(account_records)
        
        # 设置列顺序
        columns = ['序号', '企业名称', '联系人', '用户名', '登录手机号', '初始密码', '所属行业', '招商单位', '管理多企业']
        df = df[columns]
        
        # 生成文件名，包含日期和时间
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        excel_file = f"企业账号密码列表_{timestamp}.xlsx"
        
        # 保存为Excel
        writer = pd.ExcelWriter(excel_file, engine='xlsxwriter')
        df.to_excel(writer, sheet_name='账号密码列表', index=False)
        
        # 获取xlsxwriter工作簿和工作表对象
        workbook = writer.book
        worksheet = writer.sheets['账号密码列表']
        
        # 添加格式
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D7E4BC',
            'border': 1
        })
        
        # 添加一个格式来突出显示多企业账号
        multi_format = workbook.add_format({
            'bg_color': '#FCE4D6',  # 浅橙色背景
        })
        
        # 写入列标题
        for col_num, value in enumerate(columns):
            worksheet.write(0, col_num, value, header_format)
        
        # 自动调整列宽
        for i, column in enumerate(columns):
            column_width = max(len(column), df[column].astype(str).map(len).max())
            worksheet.set_column(i, i, column_width + 2)
        
        # 高亮显示多企业账号行
        for row_num, is_multi in enumerate(df['管理多企业'], 1):
            if is_multi == "是":
                worksheet.set_row(row_num, None, multi_format)
        
        # 添加筛选按钮
        worksheet.autofilter(0, 0, len(df), len(columns) - 1)
        
        # 冻结首行
        worksheet.freeze_panes(1, 0)
        
        # 添加登录说明表
        login_tips_sheet = workbook.add_worksheet('登录说明')
        login_tips = [
            ['郏县产业集聚区文件管理系统 - 登录说明'],
            [''],
            ['1. 单企业用户登录'],
            ['   - 可以使用"用户名"（即联系人姓名）登录'],
            ['   - 也可以使用"手机号"登录'],
            ['   - 初始密码为联系人手机号'],
            [''],
            ['2. 多企业用户登录'],
            ['   - 可以使用"用户名"（格式为"联系人-公司名前缀"）登录'],
            ['   - 也可以使用"手机号-序号"（如"13912345678-2"）登录'],
            ['   - 初始密码为联系人手机号（不带后缀）'],
            [''],
            ['3. 首次登录后，建议修改初始密码'],
            [''],
            ['4. 如有登录问题，请联系系统管理员']
        ]
        
        # 格式化登录说明
        title_format = workbook.add_format({
            'bold': True,
            'font_size': 14,
            'align': 'center'
        })
        
        content_format = workbook.add_format({
            'font_size': 12
        })
        
        # 写入登录说明
        login_tips_sheet.set_column(0, 0, 80)
        login_tips_sheet.write(0, 0, login_tips[0][0], title_format)
        for row_num, tip in enumerate(login_tips[1:], 1):
            login_tips_sheet.write(row_num, 0, tip[0], content_format)
        
        # 保存Excel文件
        writer.close()
        
        print(f"\n已生成账号密码Excel文件: {excel_file}")
        print("请妥善保管该文件，并及时分发给企业联系人")
        
        return True
    except Exception as e:
        print(f"生成Excel文件失败: {str(e)}")
        return False

def init_database():
    """初始化数据库"""
    app = create_app()
    with app.app_context():
        # 确认是否继续
        confirm = input("此操作将重置整个数据库! 所有现有数据将被删除。继续? (y/n): ")
        if confirm.lower() != 'y':
            print("操作已取消")
            return
        
        print("开始初始化数据库...")
        
        # 删除所有表并重新创建
        db.drop_all()
        db.create_all()
        print("数据库表结构已重置")
        
        # 创建系统管理员账户
        create_admin_user()
        
        # 创建系统设置
        create_system_settings()
        
        # 创建微信订阅消息相关表
        create_wx_subscription_tables()
        
        # 创建头像目录和默认头像
        create_avatar_directories()
        
        # 创建执法端相关模型
        create_inspection_models()
        
        # 导入企业数据
        excel_file = "企业数据.xlsx"  # Excel文件名
        account_records = []
        
        if os.path.exists(excel_file):
            account_records = import_enterprises_from_excel(excel_file)
        else:
            print(f"错误: 未找到Excel文件 '{excel_file}'")
            alt_file = input("请输入企业数据Excel文件路径: ")
            if os.path.exists(alt_file):
                account_records = import_enterprises_from_excel(alt_file)
            else:
                print("未能找到企业数据文件，跳过导入")
        
        # 生成账号密码Excel
        if account_records:
            generate_account_excel(account_records)
        
        print("\n数据库初始化完成!")

if __name__ == "__main__":
    init_database()