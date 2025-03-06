# run.py
from app import create_app, db

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        # 确保所有表都存在
        db.create_all()
    # host='0.0.0.0' 允许外部访问
    app.run(host='0.0.0.0', port=5000, debug=True)




# run.py
# from app import create_app, db
# app = create_app()
# if __name__ == '__main__':  # 注意这里使用双下划线
#     with app.app_context():
#         # 确保所有表都存在
#         db.create_all()
#     # 添加SSL证书和密钥，使用完整路径
#     app.run(
#         host='0.0.0.0', 
#         port=5000, 
#         debug=True,
#         ssl_context=('.ssl/fullchain.pem', '.ssl/privkey.key')  
#     )
# gunicorn -w 4 -b 0.0.0.0:5000 --keyfile=./ssl/privkey.key --certfile=./ssl/fullchain.pem run:app