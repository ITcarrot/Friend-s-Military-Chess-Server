import pickle

def gen(x: list[int], y: list[int]) -> list[tuple[int, int]]:
    """生成(x,y)的笛卡尔积"""
    return [(i, j) for i in x for j in y]

def rotate(coords: list[tuple[int, int]], center: tuple[int, int], deg: float) -> list[tuple[int, int]]:
    """将坐标列表绕中心点旋转deg度"""
    import math
    rad = math.radians(deg)
    cos_rad = math.cos(rad)
    sin_rad = math.sin(rad)
    cx, cy = center
    rotated = []
    for x, y in coords:
        # 平移到原点
        tx, ty = x - cx, y - cy
        # 旋转
        rx = tx * cos_rad - ty * sin_rad
        ry = tx * sin_rad + ty * cos_rad
        # 平移回原位置
        rotated.append((round(rx + cx), round(ry + cy)))
    return rotated

def gen_all(player, extra, center, deg):
    res = []
    for d in range(0, 360, deg):
        res += (rotate(player, center, d))
    for d in range(0, 360, deg):
        res += (rotate(extra, center, d))
    return res + [center]

positions = {}

# 2人初始位置
player = gen(list(range(185, 185 + 5 * 147, 147)), (list(range(550, 550 + 6 * 72, 72))))
extra = [(185, 480)]
center = (480, 480)
positions[2] = gen_all(player, extra, center, 180)

# 4人初始位置
player = gen(list(range(322, 322 + 5 * 79, 79)), (list(range(703, 703 + 6 * 53, 53))))
extra = [(322, 636), (480, 636)]
center = (480, 475)
positions[4] = gen_all(player, extra, center, 90)

# 6人初始位置
player = gen(list(range(397, 397 + 5 * 43, 43)), (list(range(708, 708 + 6 * 42, 42))))
extra = [(398, 633), (482, 591)]
center = (482, 493)
positions[6] = gen_all(player, extra, center, 60)

# 8人初始位置
player = gen(list(range(381, 381 + 5 * 49, 49)), (list(range(764, 764 + 6 * 37, 37))))
extra = [(381, 716), (439, 576), (480, 617)]
center = (480, 478)
positions[8] = gen_all(player, extra, center, 45)

pickle.dump(positions, open('positions.pkl', 'wb'))
