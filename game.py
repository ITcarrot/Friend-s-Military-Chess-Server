import json, random, copy

ALL_CHESS = [
  '司',    # 司令 x1
  '军',    # 军长 x1
  '师','师',  # 师长 x2
  '旅','旅',  # 旅长 x2
  '团','团',  # 团长 x2
  '营','营',  # 营长 x2
  '连','连','连',  # 连长 x3
  '排','排','排',  # 排长 x3
  '兵','兵','兵',  # 工兵 x3
  '雷','雷','雷',  # 地雷 x3
  '弹','弹',  # 炸弹 x2
  '旗'     # 军旗 x1
]

INIT_OFFSET = [(0, 0), (800, 800), (0, 800), (800, 0), (0, 400), (800, 400), (400, 0), (400, 800)]

class Chess:
    def __init__(self, id, team, name, x, y, alive):
        self.id = id
        self.team = team
        self.name = name
        self.x = x
        self.y = y
        self.alive = alive
    
    def compare(self, other):
        """返回战斗结果: 1表示self胜, -1表示other胜, 0表示平局"""
        if self.name == '弹' or other.name == '弹':
            return 0
        if self.name == '雷':
            if other.name == '兵':
                return -1
            else:
                return 1
        if other.name == '雷':
            if self.name == '兵':
                return 1
            else:
                return -1
        
        rank_self = ALL_CHESS.index(self.name)
        rank_other = ALL_CHESS.index(other.name)
        if rank_self < rank_other:
            return 1
        elif rank_self > rank_other:
            return -1
        else:
            return 0
    
    def to_dict(self):
        return {
            'id': self.id,
            'team': self.team,
            'name': self.name,
            'x': self.x,
            'y': self.y,
            'alive': self.alive
        }
        
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data['id'],
            team=data['team'],
            name=data['name'],
            x=data['x'],
            y=data['y'],
            alive=data['alive']
        )

class ChessBoard:
    def __init__(self, num_players):
        chess_pool = copy.copy(ALL_CHESS)
        self.chesses = []
        self.last_move = None # (old_x, old_y, new_x, new_y)
        self.last_battle_result = None
        cnt = 0
        for i in range(1, num_players + 1):
            offset_x, offset_y = INIT_OFFSET[i - 1]
            random.shuffle(chess_pool)
            for j, name in enumerate(chess_pool):
                x = (j % 5) * 40 + offset_x
                y = (j // 5) * 40 + offset_y
                chess = Chess(cnt, i, name, x, y, True)
                self.chesses.append(chess)
                cnt += 1

    def to_dict(self):
        return {
            'chesses': [chess.to_dict() for chess in self.chesses],
            'last_move': self.last_move,
            'last_battle_result': self.last_battle_result
        }

    def jsonify(self):
        return json.dumps(self.to_dict())
    
    @classmethod
    def from_json(cls, json_str):
        data = json.loads(json_str)
        board = cls(0)
        board.chesses = [Chess.from_dict(chess_data) for chess_data in data['chesses']]
        board.last_move = data['last_move']
        board.last_battle_result = data.get('last_battle_result', None)
        return board
    
    @classmethod
    def to_team_idx(cls, chess_id):
        return (chess_id // len(ALL_CHESS)) + 1

    def calculate_adjusted_position(self, original_x, original_y, target_x, target_y, new_x, new_y):
        """基于移动棋子和目标棋子的中心连线计算弹出位置
        
        Args:
            original_x, original_y: 移动棋子的原始位置
            target_x, target_y: 目标棋子的位置
            new_x, new_y: 移动的目标位置
            
        Returns:
            tuple: 调整后的位置 (adjusted_x, adjusted_y)
        """
        # 计算移动棋子和目标棋子的中心坐标
        moving_center_x = original_x + 20
        moving_center_y = original_y + 20
        target_center_x = target_x + 20
        target_center_y = target_y + 20
        
        # 计算移动方向向量
        dx = target_center_x - moving_center_x
        dy = target_center_y - moving_center_y
        
        # 计算方向向量的长度
        length = math.sqrt(dx**2 + dy**2)
        
        if length == 0:
            # 如果长度为零（罕见情况），返回原始位置
            return new_x, new_y
        
        # 归一化方向向量
        dx /= length
        dy /= length
        
        # 沿着移动方向延长40像素（棋子半径20 + 目标棋子半径20）
        adjusted_center_x = target_center_x + dx * 40
        adjusted_center_y = target_center_y + dy * 40
        
        # 将中心坐标转换回棋子左上角坐标
        adjusted_x = adjusted_center_x - 20
        adjusted_y = adjusted_center_y - 20
        
        return adjusted_x, adjusted_y

    def is_position_valid(self, x, y, exclude_chess_id):
        """检查位置是否有效且不与其他棋子重叠
        
        Args:
            x: 要检查的x坐标
            y: 要检查的y坐标
            exclude_chess_id: 要排除的棋子ID
            
        Returns:
            bool: 如果位置有效且不重叠返回True，否则返回False
        """
        # 检查边界（棋盘范围大致为0-1000像素）
        if x < 0 or x > 1000 or y < 0 or y > 1000:
            return False
        
        # 检查是否与其他棋子重叠（基于中心距离）
        for chess in self.chesses:
            if chess.id == exclude_chess_id or not chess.alive:
                continue
            
            # 计算中心点距离
            center_x1, center_y1 = x + 20, y + 20
            center_x2, center_y2 = chess.x + 20, chess.y + 20
            distance = math.sqrt((center_x1 - center_x2)**2 + (center_y1 - center_y2)**2)
            
            if distance < 40:  # 中心距离小于40像素表示重叠
                return False
        
        return True
