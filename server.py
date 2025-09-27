from flask import Flask, render_template, request, redirect, make_response, jsonify, send_from_directory
from flask_compress import Compress
from datetime import datetime
import hashlib, uuid, re, math, json, pickle
from game import *

import logging
logging.basicConfig(level=logging.DEBUG, filename='server.log', filemode='a')

app = Flask(__name__)
Compress(app)
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

def send_system_message(room_id, content):
    # 创建系统消息
    message = Message(
        room_id=room_id,
        sender='系统',
        content=content,
        is_system=True
    )
    db.session.add(message)
    db.session.commit()

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
    
    rooms = Room.query.all()
    for room in rooms:
        # 检查用户是否在这个房间的任一座位上
        for i in range(1, 9):
            attr = f'player{i}_id'
            if getattr(room, attr) == user_id:
                return redirect(f'/play/{room.room_id}')
    
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
                          user_id=user_id, room=room, colors=COLORS, positions=pickle.load(open('positions.pkl', 'rb')))

@app.route('/replay_list')
@check_login
def replay_list():
    """对局回放列表页面"""
    show_all = request.args.get('all', '0')
    if show_all == '1':
        replays = Replay.query.filter(Replay.end_id != None).order_by(Replay.id.desc()).all()
    else:
        replays = Replay.query.filter(Replay.end_id != None, Replay.end_id - Replay.start_id > 50).order_by(Replay.id.desc()).all()
    for replay in replays:
        replay.players = ', '.join(json.loads(replay.players))
    return render_template('replay_list.html', replays=replays, show_all=show_all)

@app.route('/replay/<int:replay_id>')
@check_login
def replay_view(replay_id):
    """对局回放页面"""
    replay = Replay.query.get_or_404(replay_id)
    players = json.loads(replay.players)
    records = Record.query.filter_by(room_id=replay.room_id) \
                .filter(Record.id.between(replay.start_id, replay.end_id)) \
                .order_by(Record.id).all()
    return render_template('replay.html', room_type=len(players), \
        players=enumerate(players), records=[r.board_state for r in records], colors=COLORS)

@app.route('/formation')
@check_login
def formation():
    """布阵页面"""
    return_url = request.args.get('ret', '/')
    return render_template('formation.html', return_url=return_url)

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
    user_name = User.query.get(user_id).username
    room = Room.query.get_or_404(room_id)
    
    if room.active:
        return jsonify({'status': 'error', 'message': '游戏进行中，无法踢人'})
    
    # 检查座位号是否有效
    if seat_num < 1 or seat_num > 8:
        return jsonify({'status': 'error', 'message': '无效的座位号'})
    
    # 获取被踢玩家的用户名
    seat_attr = f'player{seat_num}_id'
    kicked_player_id = getattr(room, seat_attr)
    kicked_player = User.query.get(kicked_player_id) if kicked_player_id else None
    kicked_username = kicked_player.username if kicked_player else '未知玩家'
    
    # 踢出玩家
    setattr(room, seat_attr, None)
    db.session.commit()
    # 发送系统消息通知房间内玩家
    send_system_message(room_id, f'玩家 {user_name} 把 {kicked_username} 踢出了房间。')
    
    return jsonify({'status': 'success'})

@app.route('/api/change_room_type/<int:room_id>', methods=['POST'])
@check_login
def change_room_type(room_id):
    """修改房间类型API"""
    user_name = User.query.get(request.cookies.get('user_id')).username
    room = Room.query.get_or_404(room_id)
    new_type = request.json.get('room_type')
    
    if room.active:
        return jsonify({'status': 'error', 'message': '游戏进行中，无法修改房间类型'})
    
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
    send_system_message(room_id, f'房间类型已被 {user_name} 修改为 {new_type} 人房。')
    
    return jsonify({'status': 'success'})

@app.route('/api/start_game/<int:room_id>', methods=['POST'])
@check_login
def start_game(room_id):
    """开始游戏API"""
    user_id = request.cookies.get('user_id')
    user_name = User.query.get(user_id).username
    db.session.commit()
    
    with db.session.begin():
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
        room.battle = None
        chess_board = ChessBoard(room.room_type)
        record = Record(room_id=room.room_id, board_state=chess_board.jsonify())
        db.session.add(record)
        
    replay = Replay(
        room_id=room.room_id,
        players=json.dumps([player.username for _, _, player in room.get_players()[:room.room_type]]),
        start_id=record.id,
    )
    db.session.add(replay)
    db.session.commit()
    
    send_system_message(room_id, f'{user_name} 开始了游戏')
    
    return jsonify({'status': 'success'})

@app.route('/api/stop_game/<int:room_id>', methods=['POST'])
@check_login
def stop_game(room_id):
    """结束游戏API"""
    user_id = request.cookies.get('user_id')
    with db.session.begin():
        user_name = User.query.get(user_id).username
        room = Room.query.get_or_404(room_id)
        
        # 检查房间中的用户
        user_in_room = False
        has_online_player = False
        for seat_num, player_id, player in room.get_players():
            if player_id:
                if player.is_online():
                    has_online_player = True
                if player_id == user_id:
                    user_in_room = True
        
        # 检查房间状态
        if not room.active:
            return jsonify({'status': 'error', 'message': '游戏尚未开始'})
        
        if not user_in_room and has_online_player:
            return jsonify({'status': 'error', 'message': '房间里还有其他玩家，您无法结束游戏'})
        
        # 结束游戏
        room.active = False
    
    replay = Replay.query.filter_by(room_id=room.room_id).order_by(Replay.id.desc()).first()
    replay.end_id = Record.query.order_by(Record.id.desc()).first().id
    db.session.commit()
    send_system_message(room_id, f'{user_name} 结束了游戏')
    
    return jsonify({'status': 'success'})

@app.route('/api/emoji/send', methods=['POST'])
@check_login
def send_emoji():
    """发送表情API"""
    user_id = request.cookies.get('user_id')
    room_id = request.json.get('room_id')
    emoji_id = request.json.get('emoji_id')
    x = request.json.get('x')
    y = request.json.get('y')
    
    if not emoji_id or not room_id:
        return jsonify({'status': 'error', 'message': '表情ID或房间ID不能为空'})
    
    room = Room.query.get_or_404(room_id)
    user_team = room.get_player_team(user_id)
    
    if user_team == 0:
        return jsonify({'status': 'error', 'message': '您不在游戏中，无法发送表情'})
    
    # 创建表情记录
    emoji = Emoji(
        room_id=room_id,
        team_id=user_team,
        emoji=emoji_id,
        x=x, y=y
    )
    db.session.add(emoji)
    db.session.commit()
    
    return jsonify({'status': 'success'})

@app.route('/api/chat/send', methods=['POST'])
@check_login
def send_chat_message():
    """发送聊天消息"""
    user_id = request.cookies.get('user_id')
    username = User.query.get(user_id).username
    room_id = request.json.get('room_id')
    content = request.json.get('content')
    
    if not content or not room_id:
        return jsonify({'status': 'error', 'message': '消息内容或房间ID不能为空'})
    
    # 创建消息
    message = Message(
        room_id=room_id,
        sender=username,
        content=content,
        is_system=False
    )
    db.session.add(message)
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': message.to_dict()})

@app.route('/api/chat/messages/<int:room_id>')
@check_login
def get_chat_messages(room_id):
    """获取聊天消息"""
    # 获取最近50条消息
    messages = Message.query.filter_by(room_id=room_id).order_by(Message.timestamp.desc()).limit(50).all()
    messages.reverse()  # 反转顺序，使最早的消息在前
    # 获取最近2秒的表情
    recent_emojis = Emoji.query.filter_by(room_id=room_id).filter(Emoji.timestamp >= datetime.now() - timedelta(seconds=2)).all()
    
    return jsonify({
        'status': 'success',
        'messages': [msg.to_dict() for msg in messages],
        'emojis': [emoji.to_dict() for emoji in recent_emojis]
    })

@app.route('/api/board/<int:room_id>')
@check_login
def get_board(room_id):
    """获取棋盘状态API"""
    user_id = request.cookies.get('user_id')
    room = Room.query.get_or_404(room_id)
    user_team = room.get_player_team(user_id)
    
    if not room.active:
        return jsonify({'status': 'error', 'message': '游戏尚未开始'})
    
    record = Record.query.filter_by(room_id=room_id).order_by(Record.id.desc()).first()
    if not record:
        return jsonify({'status': 'error', 'message': '棋盘数据不存在'})
    
    chess_board = ChessBoard.from_json(record.board_state)
    has40 = [False] * (room.room_type + 1)
    for chess in chess_board.chesses:
        if chess.alive and chess.name == "司":
            has40[chess.team] = True
    for chess in chess_board.chesses:
        # 检查用户是否有权限查看该棋子
        if chess.team != user_team and (chess.name != '旗' or has40[chess.team]):
            chess.name = ""
    
    battle = json.loads(room.battle) if room.battle else None
    if battle:
        battle['battle_time'] = math.ceil(datetime.now().timestamp() - battle['battle_time'])
    
    return jsonify({
        'record_id': record.id,
        'status': 'success',
        'board': chess_board.to_dict(),
        'battle': battle
    })

@app.route('/api/set_formation', methods=['POST'])
@check_login
def set_formation():
    """设置阵型API"""
    user_id = request.cookies.get('user_id')
    room_id = request.json.get('room_id')
    formation = request.json.get('formation')  # 阵型列表
    positions = request.json.get('positions')  # 位置列表
    
    if None in [room_id, formation, positions] or len(formation) != 30 or len(positions) != 30:
        return jsonify({'status': 'error', 'message': '参数不完整或格式错误'})
    
    with db.session.begin():
        room = Room.query.get_or_404(room_id)
        
        if not room.active:
            return jsonify({'status': 'error', 'message': '游戏尚未开始，无法布阵'})
        
        user_team = room.get_player_team(user_id)
        if user_team == 0:
            return jsonify({'status': 'error', 'message': '您不在游戏中，无法布阵'})
        
        record = Record.query.filter_by(room_id=room_id).order_by(Record.id.desc()).first()
        if not record:
            return jsonify({'status': 'error', 'message': '棋盘数据不存在'})
        
        chess_board = ChessBoard.from_json(record.board_state)
        
        # 获取该队伍的棋子
        chess_by_name = {}
        for chess in chess_board.chesses:
            if chess.team == user_team and chess.alive:
                chess_by_name.setdefault(chess.name, []).append(chess)
        
        # 重置该队伍的棋子位置
        for idx, name in enumerate(formation):
            if name and name in chess_by_name and chess_by_name[name]:
                chess = chess_by_name[name].pop()
                chess.x, chess.y = positions[idx]
            elif name != "":
                return jsonify({'status': 'error', 'message': f'棋子 {name} 数量不足'})
        
        chess_board.last_move = None
        chess_board.last_battle_result = None
        record = Record(room_id=room.room_id, board_state=chess_board.jsonify())
        db.session.add(record)
    
    return jsonify({'status': 'success'})

@app.route('/api/move_chess', methods=['POST'])
@check_login
def move_chess():
    """移动棋子API"""
    user_id = request.cookies.get('user_id')
    room_id = request.json.get('room_id')
    chess_id = request.json.get('chess_id')
    new_x = request.json.get('new_x')
    new_y = request.json.get('new_y')
        
    if None in [room_id, chess_id, new_x, new_y]:
        return jsonify({'status': 'error', 'message': '参数不完整'})
    
    with db.session.begin():
        room = Room.query.get_or_404(room_id)
        
        if not room.active:
            return jsonify({'status': 'error', 'message': '游戏尚未开始'})
        
        record = Record.query.filter_by(room_id=room_id).order_by(Record.id.desc()).first()
        if not record:
            return jsonify({'status': 'error', 'message': '棋盘数据不存在'})
        
        chess_board = ChessBoard.from_json(record.board_state)
        
        # 查找要移动的棋子
        chess = next((c for c in chess_board.chesses if c.id == chess_id), None)
        if not chess or not chess.alive:
            return jsonify({'status': 'error', 'message': '棋子不存在或已被吃掉'})
        
        # 检查用户是否有权限移动该棋子
        user_team = room.get_player_team(user_id)
        if chess.team != user_team:
            return jsonify({'status': 'error', 'message': '您无权移动此棋子'})
        
        # 更新棋子位置
        old_x, old_y = chess.x, chess.y
        chess.x = new_x
        chess.y = new_y
        chess_board.last_move = (old_x, old_y, new_x, new_y)
        chess_board.last_battle_result = None
        
        # 保存新的棋盘状态
        new_record = Record(room_id=room_id, board_state=chess_board.jsonify())
        db.session.add(new_record)
    
    return jsonify({'status': 'success'})

@app.route('/api/attack_chess', methods=['POST'])
@check_login
def attack_chess():
    """攻击棋子API"""
    user_id = request.cookies.get('user_id')
    room_id = request.json.get('room_id')
    attacker = request.json.get('attacker')
    defender = request.json.get('defender')
        
    if None in [room_id, attacker, defender]:
        return jsonify({'status': 'error', 'message': '参数不完整'})
    
    with db.session.begin():
        room = Room.query.get_or_404(room_id)
        user_team = room.get_player_team(user_id)
    
        if not room.active:
            return jsonify({'status': 'error', 'message': '游戏尚未开始'})
        
        if room.battle is not None:
            return jsonify({'status': 'error', 'message': '当前已有未结算的战斗'})
        
        if user_team != ChessBoard.to_team_idx(attacker):
            return jsonify({'status': 'error', 'message': '您无权发起此攻击'})
        
        room.battle = json.dumps({
            'attacker': attacker,
            'defender': defender,
            'battle_time': datetime.now().timestamp()
        })
    
    return jsonify({'status': 'success'})

@app.route('/api/respond_attack', methods=['POST'])
@check_login
def respond_attack():
    """响应攻击API"""
    user_id = request.cookies.get('user_id')
    room_id = request.json.get('room_id')
    accept = request.json.get('accept')
        
    if None in [room_id, accept]:
        return jsonify({'status': 'error', 'message': '参数不完整'})
    
    with db.session.begin():
        room = Room.query.get_or_404(room_id)
        user_team = room.get_player_team(user_id)
    
        if not room.active:
            return jsonify({'status': 'error', 'message': '游戏尚未开始'})
        
        if room.battle is None:
            return jsonify({'status': 'error', 'message': '当前没有战斗需要响应'})
        
        battle = json.loads(room.battle)
        if user_team != ChessBoard.to_team_idx(battle['defender']) and \
            (user_team == 0 or math.ceil(datetime.now().timestamp() - battle['battle_time']) < 5):
            return jsonify({'status': 'error', 'message': '您无权响应此攻击'})
        
        record = Record.query.filter_by(room_id=room_id).order_by(Record.id.desc()).first()
        if not record:
            return jsonify({'status': 'error', 'message': '棋盘数据不存在'})
        
        chess_board = ChessBoard.from_json(record.board_state)
        
        attacker = next((c for c in chess_board.chesses if c.id == battle['attacker']), None)
        defender = next((c for c in chess_board.chesses if c.id == battle['defender']), None)
        
        if not attacker or not defender or not attacker.alive or not defender.alive:
            room.battle = None
            return jsonify({'status': 'error', 'message': '攻击或防守的棋子不存在或已被吃掉'})
        
        if accept:
            result = attacker.compare(defender)
            if result > 0:
                defender.alive = False
                chess_board.last_battle_result = ['win', attacker.id, defender.id]
            elif result < 0:
                attacker.alive = False
                chess_board.last_battle_result = ['lose', defender.id, attacker.id]
            else:
                attacker.alive = False
                defender.alive = False
                chess_board.last_battle_result = ['draw']
            
            if attacker.name == '司' and not attacker.alive:
                chess_board.last_battle_result = ['40lost']
            if defender.name == '司' and not defender.alive:
                chess_board.last_battle_result = ['40lost']
            
            if defender.name == '旗':
                for chess in chess_board.chesses:
                    if chess.team == defender.team:
                        chess.alive = False
            
            chess_board.last_move = (attacker.x, attacker.y, defender.x, defender.y)
            if result > 0:
                attacker.x, attacker.y = defender.x, defender.y
            
            new_record = Record(room_id=room_id, board_state=chess_board.jsonify())
            db.session.add(new_record)
        
        room.battle = None
    
    return jsonify({'status': 'success'})

@app.route('/img/<path:filename>')
def serve_image(filename):
    """服务静态图片"""
    if re.match(r'^[0-9a-zA-Z_-]+\.[a-zA-Z]{3,4}$', filename) is None:
        return "Invalid filename", 400
    return send_from_directory('img/', filename)

@app.route('/audio/<path:filename>')
def serve_audio(filename):
    """服务静态音频"""
    if re.match(r'^[0-9a-zA-Z_-]+\.[a-zA-Z0-9]{3,4}$', filename) is None:
        return "Invalid filename", 400
    return send_from_directory('audio/', filename)

if __name__ == '__main__':
    app.run(debug=True)
