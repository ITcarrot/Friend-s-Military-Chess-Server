from flask import Flask, render_template, request, redirect, make_response, jsonify
from datetime import datetime
import hashlib
import uuid

import logging
logging.basicConfig(level=logging.DEBUG, filename='server.log', filemode='a')

app = Flask(__name__)
from db_tables import db_init
db_init(app)
from db_tables import *

# 设置唯一的邀请码
INVITATION_CODE = "自行设置"

COLORS = [
    "#000000",  # Black
    "#1f77b4",  # Blue
    "#ff7f0e",  # Orange
    "#2ca02c",  # Green
    "#d62728",  # Red
    "#9467bd",  # Purple
    "#8c564b",  # Brown
    "#e377c2",  # Pink
    "#17becf",  # Cyan
]


def check_login(func):
    """检查登录状态的装饰器"""
    def wrapper(*args, **kwargs):
        # 获取cookie中的user_id和token
        user_id = request.cookies.get('user_id')
        token = request.cookies.get('token')
        
        # 验证token是否正确
        if user_id and token:
            expected_token = hashlib.sha256((user_id + INVITATION_CODE).encode()).hexdigest()
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
        token = hashlib.sha256((user_id + INVITATION_CODE).encode()).hexdigest()
        
        # 创建响应并设置cookie
        response = make_response(redirect('/'))
        response.set_cookie('user_id', user_id, max_age=365*24*60*60)  # 30天有效期
        response.set_cookie('token', token, max_age=365*24*60*60)
        
        new_user = User(user_id=user_id, username=username, last_login=datetime.now())
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

@app.route('/play/<int:room_id>')
@check_login
def play_room(room_id):
    """棋盘房间页面"""
    user_id = request.cookies.get('user_id')
    user: User = User.query.get(user_id)
    username = user.username
    
    # 更新用户最后登录时间
    if user:
        user.last_login = datetime.now()
        db.session.commit()
    
    # 获取房间信息
    room = Room.query.get_or_404(room_id)
    
    return render_template('play.html', room_id=room_id, username=username, 
                          user_id=user_id, room=room, colors=COLORS)

@app.route('/api/update_last_login', methods=['POST'])
@check_login
def update_last_login():
    """更新用户最后登录时间"""
    user_id = request.cookies.get('user_id')
    user = User.query.get(user_id)
    if user:
        user.last_login = datetime.now()
        db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/room_status/<int:room_id>')
@check_login
def room_status(room_id):
    """获取房间状态API"""
    room: Room = Room.query.get_or_404(room_id)
    
    # 构建玩家信息
    players = []
    for seat_num, player_id, player in room.get_players():
        if player_id:
            players.append({
                'seat': seat_num,
                'user_id': player_id,
                'username': player.username,
                'online': player.is_online()
            })
    
    return jsonify({
        'room_id': room.room_id,
        'room_type': room.room_type,
        'status': room.active,
        'players': players,
        'available_seats': room.get_available_seats(),
        'can_start': room.can_start_game()
    })

@app.route('/api/take_seat/<int:room_id>/<int:seat_num>', methods=['POST'])
@check_login
def take_seat(room_id, seat_num):
    """占座API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    
    # 检查座位是否可用
    if seat_num < 1 or seat_num > room.room_type:
        return jsonify({'status': 'error', 'message': '无效的座位号'})
    
    # 检查座位是否已被占用
    seat_attr = f'player{seat_num}_id'
    if getattr(room, seat_attr):
        return jsonify({'status': 'error', 'message': '座位已被占用'})
    
    # 如果用户已在其他座位，先离开
    for i in range(1, 9):
        attr = f'player{i}_id'
        if getattr(room, attr) == user_id:
            setattr(room, attr, None)
    
    # 占用新座位
    setattr(room, seat_attr, user_id)
    db.session.commit()
    
    return jsonify({'status': 'success'})

@app.route('/api/leave_seat/<int:room_id>/<int:seat_num>', methods=['POST'])
@check_login
def leave_seat(room_id, seat_num):
    """离座API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    
    # 检查座位号是否有效
    if seat_num < 1 or seat_num > 8:
        return jsonify({'status': 'error', 'message': '无效的座位号'})
    
    # 检查用户是否在该座位上
    seat_attr = f'player{seat_num}_id'
    if getattr(room, seat_attr) != user_id:
        return jsonify({'status': 'error', 'message': '您不在此座位上'})
    
    # 离开座位
    setattr(room, seat_attr, None)
    db.session.commit()
    
    return jsonify({'status': 'success'})

@app.route('/api/kick_player/<int:room_id>/<int:seat_num>', methods=['POST'])
@check_login
def kick_player(room_id, seat_num):
    """踢出玩家API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    
    # 检查座位号是否有效
    if seat_num < 1 or seat_num > 8:
        return jsonify({'status': 'error', 'message': '无效的座位号'})
    
    # 踢出玩家
    seat_attr = f'player{seat_num}_id'
    setattr(room, seat_attr, None)
    db.session.commit()
    
    return jsonify({'status': 'success'})

@app.route('/api/change_room_type/<int:room_id>', methods=['POST'])
@check_login
def change_room_type(room_id):
    """修改房间类型API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    new_type = request.json.get('room_type')
    
    # 验证房间类型
    if new_type not in [2, 4, 6, 8]:
        return jsonify({'status': 'error', 'message': '无效的房间类型'})
    
    # 修改房间类型
    room.room_type = new_type
    
    # 如果新类型小于当前玩家人数，踢出超出位置的玩家
    occupied_seats = room.get_occupied_seats()
    for seat in occupied_seats:
        if seat > new_type:
            seat_attr = f'player{seat}_id'
            setattr(room, seat_attr, None)
    
    db.session.commit()
    
    return jsonify({'status': 'success'})

@app.route('/api/start_game/<int:room_id>', methods=['POST'])
@check_login
def start_game(room_id):
    """开始游戏API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    
    # 检查用户是否在房间中
    user_in_room = False
    for i in range(1, 9):
        attr = f'player{i}_id'
        if getattr(room, attr) == user_id:
            user_in_room = True
            break
    
    if not user_in_room:
        return jsonify({'status': 'error', 'message': '您没有落座，无法开始游戏'})
    
    # 检查房间是否已满
    if not room.is_full():
        return jsonify({'status': 'error', 'message': '房间未满，无法开始游戏'})
    
    # 检查房间状态
    if room.active:
        return jsonify({'status': 'error', 'message': '游戏已在进行中'})
    
    # 开始游戏
    room.active = True
    db.session.commit()
    
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=False)
