$.getJSON('/static/json/positions.json', function(data) {
    positions = data;
});

// 更新房间状态
function updateRoomStatus() {
    $.getJSON(`/api/room_status/${roomId}`, function(data) {
        roomType = data.room_type;
        isActive = data.status;

        // 更新房间状态
        $('#roomTypeSelect').val(data.room_type);
        $('#board-img').attr('src', `/static/img/${data.room_type}.jpg`);
        
        // 更新开始游戏按钮
        $('#startGameBtn').prop('disabled', !data.can_start);
        if (data.status) {
            $('#startGameBtn').hide();
            $('#EndGameBtn').show();
        } else {
            $('#startGameBtn').show();
            $('#EndGameBtn').hide();
        }
        
        // 创建所有座位的数组
        let allSeats = [];
        for (let i = 1; i <= data.room_type; i++) {
            allSeats.push(i);
        }
        
        // 更新玩家列表 - 按座位顺序显示
        let playersHtml = '';
        
        // 先创建已占用的座位
        let occupiedSeats = {};
        userSeat = 0; // 重置用户座位
        data.players.forEach(player => {
            occupiedSeats[player.seat] = player;
            
            // 记录用户座位
            if (player.user_id === userId) {
                userSeat = player.seat;
            }
        });
        
        // 按座位顺序显示
        allSeats.forEach(seat => {
            if (occupiedSeats[seat]) {
                const player = occupiedSeats[seat];
                playersHtml += `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge me-2" style="background:${colors[seat]}">${seat}号位</span>
                            <span>${player.username}</span>
                            <span class="badge bg-${player.online ? 'success' : 'danger'} ms-2">
                                ${player.online ? '在线' : '离线'}
                            </span>
                        </div>
                        <div>
                            ${player.user_id !== userId ? `
                                <button class="btn btn-sm btn-outline-danger kick-btn" data-seat="${seat}">
                                    <i class="fas fa-user-times"></i>
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-outline-warning leave-btn" data-seat="${seat}">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            `}
                        </div>
                    </div>
                `;
            } else {
                // 空座位
                playersHtml += `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge me-2" style="background:${colors[seat]}">${seat}号位</span>
                            <span class="text-muted">空座位</span>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary seat-btn" data-seat="${seat}">
                                <i class="fas fa-chair"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        });
        
        $('#playersList').html(playersHtml);
        
        // 更新用户座位信息
        if (userSeat > 0) {
            $('#userSeatInfo').html(`您坐在 <span class="badge" style="background:${colors[userSeat]}">${userSeat}号位</span> - 您可以点击离座按钮退出座位`);
        } else {
            $('#userSeatInfo').html('您当前是观战状态 - 点击空座位的椅子图标可以加入游戏');
        }
        
        // 绑定事件
        bindEvents();
    });
}

let chessMap = {};
let selectedId = null;
let selectedForTag = null;
function updateBoard(board, battle) {
  const container = $("#boardContainer");
  const arrowLayer = $("#arrowLayer");
  let tags = localStorage.getItem(`tags_${roomId}`) || '{}';
  tags = JSON.parse(tags);

  // 更新棋子
  board.chesses.forEach(chess => {
    let el = chessMap[chess.id];
    if (!el) {
        // 新建棋子节点 (Bootstrap 风格圆形按钮)
        el = $(`<div class="btn btn-sm rounded-circle border fw-bold chess"></div>`);
        el.attr("data-id", chess.id);
        el.attr("data-team", chess.team);
        container.append(el);
        chessMap[chess.id] = el;
        // 设置不同队伍颜色
        el.css("background-color", colors[chess.team]);
      
        // 点击棋子事件
        el.on("click", function(e) {
            e.stopPropagation(); // 阻止冒泡到棋盘
            const cid = parseInt($(this).attr("data-id"));
            const chessObj = board.chesses.find(c => c.id === cid);

            if (chessObj.team == userSeat) {
                if (selectedId === cid) {
                    // 再点同一颗 -> 取消选中
                    $(this).removeClass("border-3 border-dark");
                    selectedId = null;
                } else {
                    // 切换选中
                    if (selectedId !== null) {
                        chessMap[selectedId].removeClass("border-3 border-dark");
                    }
                    $(this).addClass("border-3 border-dark");
                    selectedId = cid;
                    $('#selectSound')[0].play();
                }
            }else{
                if (selectedId == null){
                    selectedForTag = cid;
                    $('#tagPopup').css({
                        left: ($(this).position().left + 45) + "px",
                        top:  ($(this).position().top - 10) + "px"
                    }).show();
                } else {
                    if (chessMap[selectedId].text() == '雷' || chessMap[selectedId].text() == '旗') {
                        alert('雷和旗不能攻击！');
                        return;
                    }
                    $.ajax({
                        url: '/api/attack_chess',
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            room_id: roomId,
                            attacker: selectedId,
                            defender: cid
                        }),
                        success: function(response) {
                            if (response.status !== 'success') {
                                alert('攻击失败: ' + response.message);
                            }
                        }
                    });
                    chessMap[selectedId].removeClass("border-3 border-dark");
                    selectedId = null;
                }
            }
        });
    }
    if (chess.name == '')
        el.text(tags[chess.id] || ''); // 显示标记
    else
        el.text(chess.name); // 亮旗会变，因此放外面

    if (chess.alive) {
        el.show();

        // 平滑移动动画（300ms）
        el.stop(true).animate({
            left: chess.x + "px",
            top:  chess.y + "px"
        }, 300);
    } else {
        el.hide();
    }
  });

  // 更新箭头
  arrowLayer.find("line").remove();
  if (board.last_move) {
    drawArrow(board.last_move);
  }
  $('#attackPopup').hide();
  if (battle) {
    const attacker = battle.attacker;
    const defender = battle.defender;
    const atkChess = board.chesses.find(c => c.id === attacker);
    const defChess = board.chesses.find(c => c.id === defender);
    if (atkChess && defChess) {
        let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", atkChess.x + 20); // 棋子中心
        line.setAttribute("y1", atkChess.y + 20);
        line.setAttribute("x2", defChess.x + 20);
        line.setAttribute("y2", defChess.y + 20);
        line.setAttribute("stroke", "red");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrowheadR)");
        arrowLayer.append(line);

        $('#attackPopup').css({
            left: (defChess.x - 40) + "px",
            top:  (defChess.y - 60) + "px"
        });
        if(battle.battle_time < 5)
            $('#attackCountdown').text(` ${5 - battle.battle_time}`);
        else
            $('#attackCountdown').text(``);
        if (defChess.team == userSeat || (userSeat !== 0 && battle.battle_time >= 5))
            $('#attackPopup').show();
    }
  }
}
function drawArrow(move) {
    const [old_x, old_y, new_x, new_y] = move;
    let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", old_x + 20); // 棋子中心
    line.setAttribute("y1", old_y + 20);
    line.setAttribute("x2", new_x + 20);
    line.setAttribute("y2", new_y + 20);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("marker-end", "url(#arrowheadB)");
    arrowLayer.append(line);
}

const chessOrder = ['雷', '司', '军', '师', '旅', '团', '营', '连', '排', '兵', '旗'];
let last_battle_pair = (null, null);
let last_record_id = null;
function playSound(battle, record_id, battle_result) {
    battle_pair = [battle ? battle.attacker : null, battle ? battle.defender : null];
    if (battle && (battle_pair[0] != last_battle_pair[0] || battle_pair[1] != last_battle_pair[1])) {
        $('#attackSound')[0].play();
    }
    last_battle_pair = battle_pair;

    if (record_id != last_record_id) {
        if (battle_result) {
            $('#' + battle_result[0] + 'Sound')[0].play();
        } else {
            $('#moveSound')[0].play();
        }
        if (battle_result && battle_result.length > 1){
            let winner = chessMap[battle_result[1]].text();
            let loser = chessMap[battle_result[2]].text();
            let guessWinner = '!';
            if (chessOrder.indexOf(loser) > 0) {
                guessWinner = chessOrder[chessOrder.indexOf(loser) - 1];
            }
            if (winner == '' || winner == '!' || chessOrder.indexOf(guessWinner) < chessOrder.indexOf(winner)) {
                let tags = localStorage.getItem(`tags_${roomId}`) || '{}';
                tags = JSON.parse(tags);
                tags[battle_result[1]] = guessWinner;
                localStorage.setItem(`tags_${roomId}`, JSON.stringify(tags));
            }
        }
        last_record_id = record_id;
        drawSector(1);
    }
}

// 获取聊天消息
let last_msg_timestamp = '';
function updateChatMessages() {
    $.getJSON(`/api/chat/messages/${roomId}`, function(data) {
        if (data.status === 'success') {
            let messagesHtml = '';
            
            // 生成消息HTML
            data.messages.forEach(msg => {
                if (msg.is_system) {
                    // 系统消息
                    messagesHtml += `
                        <div class="mb-2 text-center">
                            <small class="text-muted">[${msg.timestamp}] ${msg.content}</small>
                        </div>
                    `;
                } else {
                    // 用户消息
                    messagesHtml += `
                        <div class="mb-2">
                            <strong>${msg.sender}:</strong> ${msg.content}
                            <small class="text-muted float-end">${msg.timestamp}</small>
                        </div>
                    `;
                }
            });
            
            $('#chatWindow').html(messagesHtml);
            
            // 滚动到底部
            new_last_msg_timestamp = data.messages.length > 0 ? data.messages[data.messages.length - 1].timestamp : '';
            if(new_last_msg_timestamp !== last_msg_timestamp){
                last_msg_timestamp = new_last_msg_timestamp;
                $('#chatWindow').scrollTop($('#chatWindow')[0].scrollHeight);
            }

            // 在弹窗显示最近5秒的消息
            const messagesForPopup = data.messages.filter(msg => { return msg.is_recent; });
            const messagesContainer = $('#chatPopup');

            // 显示最近5秒的消息
            messagesContainer.empty();
            messagesForPopup.forEach(msg => {
                messagesContainer.append(`
                    <div class="mb-2">
                        <strong>${msg.sender}:</strong> ${msg.content}
                        <small class="text-muted float-end">${msg.timestamp}</small>
                    </div>
                `);
            });
            if(messagesForPopup.length > 0)
                messagesContainer.show();
            else
                messagesContainer.hide();
            
            // 显示emoji表情
            const container = $("#boardContainer");
            container.find("img.emoji").remove();
            data.emojis.forEach(emoji => {
                const img = $('<img>').addClass('emoji').attr('src', '/static/img/emoji' + emoji.emoji + '.png').css({
                    left: emoji.x,
                    top: emoji.y,
                    position: 'absolute',
                    width: '60px',
                    height: '60px'
                });
                img.css({
                    border: '2px solid ' + colors[emoji.team_id],
                    borderRadius: '12px',
                    boxSizing: 'border-box',
                });
                container.append(img);
            });
        }
    });
}

// 发送聊天消息
function sendChatMessage() {
    const content = $('#chatInput').val().trim();
    if (content) {
        $.ajax({
            url: '/api/chat/send',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                room_id: roomId,
                content: content
            }),
            success: function(response) {
                if (response.status === 'success') {
                    $('#chatInput').val(''); // 清空输入框
                    updateChatMessages(); // 更新消息显示
                } else {
                    alert('发送消息失败: ' + response.message);
                }
            }
        });
    }
}

function sendEmoji(id)
{
    pos = $('#emojiPopup').position();
    const x = pos.left + 180;
    const y = pos.top + 42;
    // 直接显示刚发送的emoji表情
    const container = $("#boardContainer");
    const img = $('<img>').addClass('emoji').attr('src', '/static/img/emoji' + id + '.png').css({
        left: x - 30,
        top: y - 30,
        position: 'absolute',
        width: '60px',
        height: '60px'
    });
    img.css({
        border: '2px solid ' + colors[userSeat],
        borderRadius: '12px',
        boxSizing: 'border-box',
    });
    container.append(img);
    $.ajax({
        url: '/api/emoji/send',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            'room_id': roomId,
            'emoji_id': id,
            'x': x - 30,
            'y': y - 30
        }),
        success: function(response) {
            if (response.status !== 'success') {
                alert('发送Emoji失败: ' + response.message);
            }
        }
    });
    $('#emojiPopup').hide();
}

function tagChess(tag) {
    if (tag === 'X') tag = '';
    if(selectedForTag !== null){
        tags = localStorage.getItem(`tags_${roomId}`) || '{}';
        tags = JSON.parse(tags);
        tags[selectedForTag] = tag;
        localStorage.setItem(`tags_${roomId}`, JSON.stringify(tags));
        selectedForTag = null;
        $('#tagPopup').hide();
    }
}

// 绑定事件处理函数
function bindEvents() {
    // 占座按钮
    $('.seat-btn').click(function() {
        const seat = $(this).data('seat');
        $.post(`/api/take_seat/${roomId}/${seat}`, function(response) {
            if (response.status === 'success') {
                updateRoomStatus();
            } else {
                alert(response.message);
            }
        });
    });
    
    // 离座按钮
    $('.leave-btn').click(function() {
        const seat = $(this).data('seat');
        if(!isActive || confirm('当前游戏正在进行中，离座将会退出游戏。确定要离座吗？')){
            $.post(`/api/leave_seat/${roomId}/${seat}`, function(response) {
                if (response.status === 'success') {
                    updateRoomStatus();
                } else {
                    alert(response.message);
                }
            });
        }
    });
    
    // 踢人按钮
    $('.kick-btn').click(function() {
        const seat = $(this).data('seat');
        if (confirm('确定要踢出该玩家吗？')) {
            $.post(`/api/kick_player/${roomId}/${seat}`, function(response) {
                if (response.status === 'success') {
                    updateRoomStatus();
                } else {
                    alert(response.message);
                }
            });
        }
    });
}

// 修改房间类型
$('#roomTypeSelect').change(function(e) {
    const newType = $(this).val();
    if (confirm(`确定要修改房间类型为${newType}人吗？超出位置的玩家将被自动踢出。`)) {
        $.ajax({
            url: `/api/change_room_type/${roomId}`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ room_type: parseInt(newType) }),
            success: function(response) {
                if (response.status === 'success') {
                    updateRoomStatus();
                } else {
                    alert(response.message);
                }
            }
        });
    } else {
        e.preventDefault();
    }
});

// 开始游戏
$('#startGameBtn').click(function() {
    $.post(`/api/start_game/${roomId}`, function(response) {
        if (response.status === 'success') {
            updateRoomStatus();
        } else {
            alert(response.message);
        }
    });
});

// 结束游戏
$('#EndGameBtn').click(function() {
    if (confirm('确定要结束当前游戏吗？')) {
        $.post(`/api/stop_game/${roomId}`, function(response) {
            if (response.status === 'success') {
                updateRoomStatus();
            } else {
                alert(response.message);
            }
        });
    }
});

// 防止弹窗穿透
$('#tagPopup, #emojiPopup, #attackPopup').click(function(e) {
    e.stopPropagation();
});
// 棋盘点击：移动己方选中棋子
$("#boardContainer").on("click", function(e) {
    if($('#emojiPopup').is(':visible')){
        $('#emojiPopup').hide();
        return;
    }
    if ($('#tagPopup').is(':visible')) {
        $('#tagPopup').hide();
        selectedForTag = null;
        return;
    }

    if (selectedId === null) {
        // 没有选中棋子，显示表情选择
        if (userSeat > 0) {
            $('#emojiPopup').css({
                left: (e.pageX - $(this).offset().left - 180) + "px",
                top:  (e.pageY - $(this).offset().top - 42) + "px"
            }).show();
        }
        return;
    }

    const offset = $(this).offset();
    let x = e.pageX - offset.left - 20;
    let y = e.pageY - offset.top - 20;

    // 找到最近的9个可用点，按距离排序
    const pool = positions[roomType];
    let nearest = pool.map(pos => {
        return {
            pos: pos,
            dist: Math.hypot(pos[0] - x, pos[1] - y)
        };
    });
    nearest.sort((a, b) => a.dist - b.dist);
    nearest = nearest.slice(0, 9);
    // 从最近的9个点中选择一个未被占用的点
    for (let item of nearest) 
        if (item.dist < 40) { // 至少距离40像素以内
            const occupied = Object.values(chessMap).some(el => {
                const elX = parseInt(el.css("left"));
                const elY = parseInt(el.css("top"));
                return el.is(":visible") && Math.hypot(elX - item.pos[0], elY - item.pos[1]) < 20; // 20像素内视为占用
            });
            if (!occupied) {
                x = item.pos[0];
                y = item.pos[1];
                break;
            }
        }

    // 先弄出箭头
    const [old_x, old_y] = [chessMap[selectedId].position().left, chessMap[selectedId].position().top];
    drawArrow([old_x, old_y, x, y]);
    // 这里你可能要发请求给后端 API 告诉服务器移动动作
    $.ajax({
        url: '/api/move_chess',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            room_id: roomId,
            chess_id: selectedId,
            new_x: x,
            new_y: y
        }),
        success: function(response) {
            if (response.status !== 'success') {
                alert('移动失败: ' + response.message);
            } else {
                drawArrow([old_x, old_y, x, y]); // 确认移动后再画一次箭头
            }
        }
    });

    // 移动后取消选中
    chessMap[selectedId].removeClass("border-3 border-dark");
    selectedId = null;
});

function respondToAttack(accept) {
    $.ajax({
        url: '/api/respond_attack',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            room_id: roomId,
            accept: accept
        }),
        success: function(response) {
            if (response.status !== 'success') {
                alert('操作失败: ' + response.message);
            }
        }
    });
}

$('#acceptAttack').click(function(e) {
    e.stopPropagation();
    respondToAttack(true);
});

$('#rejectAttack').click(function(e) {
    e.stopPropagation();
    respondToAttack(false);
});

// 发送消息按钮点击事件
$('#sendMessageBtn').click(sendChatMessage);

// 输入框回车键发送消息
$('#chatInput').keypress(function(e) {
    if (e.which === 13) { // 回车键
        sendChatMessage();
        return false; // 阻止默认行为
    }
});

$('#tagFirstRow').click(function() {
    let tags = localStorage.getItem(`tags_${roomId}`) || '{}';
    tags = JSON.parse(tags);
    const pool = positions[roomType];
    for (let i = 0; i < 30 * roomType; i += 6) {
        const pos = pool[i];
        // 找到该位置的棋子
        const chessId = Object.keys(chessMap).find(id => {
            const el = chessMap[id];
            const elX = parseInt(el.css("left"));
            const elY = parseInt(el.css("top"));
            return el.is(":visible") && Math.hypot(elX - pos[0], elY - pos[1]) < 20; // 20像素内视为同一位置
        });
        if (chessId && !tags[chessId]) {
            // 标记首行
            tags[chessId] = '!';
        }
    }
    localStorage.setItem(`tags_${roomId}`, JSON.stringify(tags));
});

$('#clearTagBtn').click(function() {
    localStorage.removeItem(`tags_${roomId}`);
});

// 定时更新房间状态和用户最后登录时间
setInterval(function() {
    updateRoomStatus();
    $.post('/api/update_last_login');
}, 500);

setInterval(() => {
    if(isActive){
        $.getJSON(`/api/board/${roomId}`, function(res) {
            if (res.status === "success") {
                updateBoard(res.board, res.battle);
                playSound(res.battle, res.record_id, res.board.last_battle_result);
            }
        });
    }else{
        // 清除棋盘
        Object.values(chessMap).forEach(el => el.remove());
        chessMap = {};
        selectedId = null;
        $("#arrowLayer").find("line").remove();
    }
}, 500);

// 定时更新聊天消息
setInterval(updateChatMessages, 1000);

// 行棋提示器
let sectorStep = 0;
function drawSector(delta) {
    sectorStep = (sectorStep + delta) % roomType;
    const n = roomType;
    const angle = 360 / n;
    const startAngle = angle * -sectorStep - angle / 2 - 90;
    const endAngle = angle * -sectorStep + angle / 2 - 90;
    const r = 100, cx = 100, cy = 100;
    const rad = a => a * Math.PI / 180;
    const x1 = cx + r * Math.cos(rad(startAngle));
    const y1 = cy + r * Math.sin(rad(startAngle));
    const x2 = cx + r * Math.cos(rad(endAngle));
    const y2 = cy + r * Math.sin(rad(endAngle));
    const largeArc = angle > 180 ? 1 : 0;
    const d = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z'
    ].join(' ');
    $('#sectorPath').attr('d', d);
}
$('#sectorLeftBtn').click(function() {
    drawSector(-1);
});
$('#sectorRightBtn').click(function() {
    drawSector(1);
});

let formationPos = 0;
let previewChess = [];
function renderFormationPreview()
{
    Object.values(previewChess).forEach(el => el.remove());
    previewChess = [];

    const select = $('#formationSelect');
    const idx = parseInt(select.val());
    if (isNaN(idx) || idx < 0) {
        $('#setFormationBtn').prop('disabled', true);
        return;
    }
    let formations = localStorage.getItem('formations') || '[]';
    formations = JSON.parse(formations);
    const formation = formations[idx].matrix;
    $('#setFormationBtn').prop('disabled', false);

    // 计算偏移
    const pool = positions[roomType];
    formationPos = formationPos % roomType;
    const basePos = formationPos * 30;

    // 显示预览
    formation.forEach((text, i) => {
        if (text === '') return;
        let el = $(`<div class="btn btn-sm rounded-circle border fw-bold chess"></div>`);
        el.css("background-color", colors[0]);
        el.text(text);
        el.css({
            left: (pool[basePos + i][0]) + "px",
            top:  (pool[basePos + i][1]) + "px"
        });
        $('#boardContainer').append(el);
        previewChess.push(el);
    });
}
let lastFormationsStr = '';
$('#formationSelect').on('focus', function() {
    let formationsStr = localStorage.getItem('formations') || '[]';
    if (formationsStr === lastFormationsStr) return; // 没有变化不刷新
    lastFormationsStr = formationsStr;
    const select = $(this);
    select.empty();
    select.append($('<option>').val(-1).text('请选择'));
    let formations = JSON.parse(formationsStr);
    formations.forEach((f, i) => {
        select.append($('<option>').val(i).text(f.name));
    });
    renderFormationPreview();
});
$('#formationSelect').change(function() {
    renderFormationPreview();
});
$('#formationPosLeft').click(function() {
    formationPos = (formationPos - 1 + roomType) % roomType;
    renderFormationPreview();
});
$('#formationPosRight').click(function() {
    formationPos = (formationPos + 1) % roomType;
    renderFormationPreview();
});
$('#setFormationBtn').click(function() {
    if (userSeat === 0) {
        alert('观战状态无法布阵，请先占座！');
        return;
    }
    if (!isActive) {
        alert('当前游戏未开始，无法布阵！');
        return;
    }

    const select = $('#formationSelect');
    const idx = parseInt(select.val());
    let formations = localStorage.getItem('formations') || '[]';
    formations = JSON.parse(formations);
    const formation = formations[idx].matrix;

    previewChess.forEach(el => el.remove());
    previewChess = [];
    
    $.ajax({
        url: '/api/set_formation',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            room_id: roomId,
            formation: formation,
            positions: positions[roomType].slice(formationPos * 30, formationPos * 30 + 30)
        }),
        success: function(response) {
            if (response.status === 'success') {
                alert('布阵成功！');
            } else {
                alert('布阵失败: ' + response.message);
            }
        }
    });
});

// 初始加载
$(document).ready(function() {
    updateRoomStatus();
    updateChatMessages();
});
