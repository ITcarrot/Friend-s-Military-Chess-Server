from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone

def db_init(app):
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sqlite.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    global db
    db = SQLAlchemy(app)
    
    global User
    class User(db.Model):
        user_id = db.Column(db.String(8), primary_key=True)
        username = db.Column(db.String(80), nullable=False)
        last_login = db.Column(db.DateTime, nullable=False)
        
        def is_online(self):
            """检查用户是否在线（3秒内活跃）"""
            return datetime.now() - self.last_login < timedelta(seconds=3)
    
    global Room
    class Room(db.Model):
        room_id = db.Column(db.Integer, primary_key=True)
        player1_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player2_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player3_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player4_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player5_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player6_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player7_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        player8_id = db.Column(db.String(8), db.ForeignKey('user.user_id'))
        room_type = db.Column(db.Integer, nullable=False, default=2)  # 2, 4, 6, 8人
        active = db.Column(db.Boolean, nullable=False, default=False)  # 空闲, 游戏中
        
        # 关系定义
        player1 = db.relationship('User', foreign_keys=[player1_id])
        player2 = db.relationship('User', foreign_keys=[player2_id])
        player3 = db.relationship('User', foreign_keys=[player3_id])
        player4 = db.relationship('User', foreign_keys=[player4_id])
        player5 = db.relationship('User', foreign_keys=[player5_id])
        player6 = db.relationship('User', foreign_keys=[player6_id])
        player7 = db.relationship('User', foreign_keys=[player7_id])
        player8 = db.relationship('User', foreign_keys=[player8_id])
        
        def get_players(self):
            """获取所有玩家列表"""
            return [
                (1, self.player1_id, self.player1),
                (2, self.player2_id, self.player2),
                (3, self.player3_id, self.player3),
                (4, self.player4_id, self.player4),
                (5, self.player5_id, self.player5),
                (6, self.player6_id, self.player6),
                (7, self.player7_id, self.player7),
                (8, self.player8_id, self.player8),
            ]
        
        def get_occupied_seats(self):
            """获取已占用的座位"""
            occupied = []
            for seat_num, player_id, player in self.get_players():
                if player_id:
                    occupied.append(seat_num)
            return occupied
        
        def is_full(self):
            """检查房间是否已满"""
            return len(self.get_occupied_seats()) >= self.room_type
        
        def get_available_seats(self):
            """获取可用座位"""
            return [i for i in range(1, self.room_type + 1) if i not in self.get_occupied_seats()]
        
        def can_start_game(self):
            """检查是否可以开始游戏"""
            return self.is_full() and not self.active
    
    with app.app_context():
        db.create_all()
        # 创建9个默认房间
        for i in range(1, 10):
            room = Room.query.get(i)
            if not room:
                room = Room(room_id=i)
                db.session.add(room)
        db.session.commit()
