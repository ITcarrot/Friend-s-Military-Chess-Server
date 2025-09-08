from flask import Flask, render_template, request, redirect, make_response
import hashlib
import uuid

app = Flask(__name__)
from db_tables import db_init
db_init(app)
from db_tables import *

# 设置唯一的邀请码
INVITATION_CODE = "自行设置"

def check_login(func):
    """检查登录状态的装饰器"""
    def wrapper(*args, **kwargs):
        # 获取cookie中的user_id和token
        user_id = request.cookies.get('user_id')
        token = request.cookies.get('token')
        
        # 验证token是否正确
        if user_id and token:
            expected_token = hashlib.md5((user_id + INVITATION_CODE).encode()).hexdigest()
            if token == expected_token:
                # 验证通过，执行原函数
                return func(*args, **kwargs)
        
        # 验证失败，跳转到注册页面
        return redirect('/register')
    
    # 重命名函数，避免Flask路由冲突
    wrapper.__name__ = func.__name__
    return wrapper

@app.route('/compare')
def compare():
    """军棋大小判定器"""
    return render_template('compare.html')

@app.route('/')
@check_login
def index():
    """首页"""
    user_id = request.cookies.get('user_id')
    username = User.query.filter_by(user_id=user_id).first().username
    return render_template('index.html', username=username, user_id=user_id)

@app.route('/register', methods=['GET', 'POST'])
def register():
    """注册页面"""
    if request.method == 'POST':
        # 获取表单数据
        username = request.form.get('username')
        invitation_code = request.form.get('invitation_code')
        
        # 验证邀请码
        if invitation_code != INVITATION_CODE:
            return render_template('register.html', error='邀请码不正确')
        
        # 生成用户ID和token
        while True:
            user_id = str(uuid.uuid4())[:8]  # 取UUID的前8位作为用户ID
            if not User.query.filter_by(user_id=user_id).first():
                break
        token = hashlib.md5((user_id + INVITATION_CODE).encode()).hexdigest()
        
        # 创建响应并设置cookie
        response = make_response(redirect('/'))
        response.set_cookie('user_id', user_id, max_age=365*24*60*60)  # 30天有效期
        response.set_cookie('token', token, max_age=365*24*60*60)
        
        new_user = User(user_id=user_id, username=username, last_login=db.func.now())
        db.session.add(new_user)
        db.session.commit()
        
        return response
    
    # GET请求，显示注册表单
    return render_template('register.html')

@app.route('/update_username', methods=['POST'])
@check_login
def update_username():
    """更新用户名"""
    new_username = request.form.get('new_username')
    if new_username:
        user_id = request.cookies.get('user_id')
        user = User.query.filter_by(user_id=user_id).first()
        if user:
            user.username = new_username
            db.session.commit()
    return redirect('/')

if __name__ == '__main__':
    app.run(debug=False)
