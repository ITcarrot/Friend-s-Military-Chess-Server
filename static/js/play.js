function ajaxWithLoading(options) {
    $('#loadingOverlay').fadeIn();
    return $.ajax(options)
        .fail(function() {
            alert('网络错误，操作失败，请重试');
        })
        .always(function() {
            $('#loadingOverlay').stop().hide();
        });
}

function postWithLoading(url, data, success) {
    $('#loadingOverlay').fadeIn();
    $.post(url, data, success)
    .fail(function() {
        alert('网络错误，操作失败，请重试');
    }).always(function() {
        $('#loadingOverlay').stop().hide();
    });
}

$.getJSON('/static/json/positions.json', function(data) {
    positions = data;
});

// 更新房间状态
function updateRoomStatus(data) {
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
    let new_userSeat = 0; // 重置用户座位
    data.players.forEach(player => {
        occupiedSeats[player.seat] = player;
        
        // 记录用户座位
        if (player.user_id === userId) {
            new_userSeat = player.seat;
        }
    });
    if (new_userSeat !== userSeat) {
        userSeat = new_userSeat;
        last_record_id = -1; // 座位变化，重置记录ID
    }
    
    // 按座位顺序显示
    allSeats.forEach(seat => {
        if (occupiedSeats[seat]) {
            const player = occupiedSeats[seat];
            playersHtml += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge me-2" style="background:${colors[seat]}">玩家${seat}</span>
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
                        <span class="badge me-2" style="background:${colors[seat]}">玩家${seat}</span>
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
    
    if (playersHtml != $('#playersList').html()) {
        $('#playersList').html(playersHtml);
        // 绑定事件
        bindEvents();
    }

    // 更新用户座位信息
    if (userSeat > 0) {
        $('#userSeatInfo').html(`您是 <span class="badge" style="background:${colors[userSeat]}">玩家${userSeat}</span> - 您可以点击离座按钮退出座位`);
    } else {
        $('#userSeatInfo').html('您当前是观战状态 - 点击空座位的椅子图标可以加入游戏');
    }
}

function drawArrow(move) {
    const arrowLayer = $("#arrowLayer");
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

const chessOrder = ['雷', '司', '军', '师', '旅', '团', '营', '连', '排', '兵'];
let chessMap = {};
let selectedId = null;
let selectedForTag = null;
let roundTickingInterval = -1;
let allowedToMove = false;
function updateBoard(board, next_player) {
    const container = $("#boardContainer");
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
                } else {
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
                        if (allowedToMove || confirm('当前不是您的回合，确定要攻击吗？')) {
                            ajaxWithLoading({
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
                        }
                        chessMap[selectedId].removeClass("border-3 border-dark");
                        selectedId = null;
                    }
                }
            });
        }
        el.attr("data-name", chess.name); // 亮旗会变，因此放外面，在updateTags里更新
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
    const arrowLayer = $("#arrowLayer");
    arrowLayer.find("line").each(function(_, e){
        if (e.getAttribute('stroke') == 'black')
            e.remove();
    });
    if (board.last_move) {
        drawArrow(board.last_move);
    }

    const battle_result = board.last_battle_result;
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
        if (winner == '' || winner == '!' ||
            (0 <= chessOrder.indexOf(guessWinner) && chessOrder.indexOf(guessWinner) < chessOrder.indexOf(winner))) {
            let tags = localStorage.getItem(`tags_${roomId}`) || '{}';
            tags = JSON.parse(tags);
            tags[battle_result[1]] = guessWinner;
            localStorage.setItem(`tags_${roomId}`, JSON.stringify(tags));
        }
    }

    $('.round-indicator').show();
    $('.round-indicator').css('--bs-border-color', colors[next_player]);
    if (userSeat && next_player == userSeat) {
        clearInterval(roundTickingInterval);
        roundTickingInterval = setInterval(function() {$('#clockSound')[0].play();}, 2000);
        $('.round-indicator').addClass('active');
        $('.round-indicator').css('background-color', colors[next_player]);
    } else {
        clearInterval(roundTickingInterval);
        $('.round-indicator').removeClass('active');
        $('.round-indicator').css('background', 'none');
    }
    allowedToMove = next_player == 0 || next_player == userSeat
                    || (board.last_move && board.last_move[4] == userSeat);
}

function updateTags() {
    let tags = localStorage.getItem(`tags_${roomId}`) || '{}';
    tags = JSON.parse(tags);
    for (let id in chessMap)
        chessMap[id].text(chessMap[id].attr("data-name") || tags[id] || '');
}

let last_battle_pair = [null, null];
function updateBattle(battle) {
    const arrowLayer = $("#arrowLayer");
    // 清除旧的攻击箭头
    arrowLayer.find("line").each(function(_, e){
        if (e.getAttribute('stroke') == 'red')
            e.remove();
    });
    $('#attackPopup').hide();
    if (battle) {
        const attacker = battle.attacker;
        const defender = battle.defender;
        const atkChess = chessMap[attacker];
        const defChess = chessMap[defender];
        if (atkChess && defChess) {
            let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", atkChess.position().left + 20); // 棋子中心
            line.setAttribute("y1", atkChess.position().top + 20);
            line.setAttribute("x2", defChess.position().left + 20);
            line.setAttribute("y2", defChess.position().top + 20);
            line.setAttribute("stroke", "red");
            line.setAttribute("stroke-width", "2");
            line.setAttribute("marker-end", "url(#arrowheadR)");
            arrowLayer.append(line);

            $('#attackPopup').css({
                left: (defChess.position().left - 40) + "px",
                top:  (defChess.position().top - 60) + "px"
            });
            if(battle.battle_time < 5)
                $('#attackCountdown').text(` ${5 - battle.battle_time}`);
            else
                $('#attackCountdown').text(``);
            if (defChess.attr('data-team') == userSeat || (userSeat !== 0 && battle.battle_time >= 5))
                $('#attackPopup').show();
        }

        let battle_pair = [battle.attacker, battle.defender];
        if (battle && (battle_pair[0] != last_battle_pair[0] || battle_pair[1] != last_battle_pair[1])) {
            $('#attackSound')[0].play();
        }
        last_battle_pair = battle_pair;
    } else {
        last_battle_pair = [null, null];
    }
}

// 获取聊天消息
let last_msg_id = -1;
function updateChatMessages(messages) {
    if (last_msg_id !== -1) {
        // 在弹窗显示最近5秒的消息
        const popupContainer = $('#chatPopup');

        popupContainer.children().each(function(_, el) {
            const msgTime = new Date(el.timestamp);
            const now = new Date();
            if (now - msgTime > 5000) {
                el.remove();
            }
        });
        messages.forEach(msg => {
            item = $(`
                <div class="mb-2">
                    <strong>${msg.sender}:</strong> ${msg.content}
                    <small class="text-muted float-end">${msg.timestamp}</small>
                </div>
            `);
            item[0].timestamp = new Date();
            popupContainer.append(item);
        });
        if(popupContainer.children().length)
            popupContainer.show();
        else
            popupContainer.hide();
    }

    const container = $('#chatWindow');
    
    messages.forEach(msg => {
        if (msg.is_system) {
            // 系统消息
            item = $(`
                <div class="mb-2 text-center">
                    <small class="text-muted">[${msg.timestamp}] ${msg.content}</small>
                </div>
            `);
        } else {
            // 用户消息
            item = $(`
                <div class="mb-2">
                    <strong>${msg.sender}:</strong> ${msg.content}
                    <small class="text-muted float-end">${msg.timestamp}</small>
                </div>
            `);
        }
        container.append(item);
        last_msg_id = msg.id;
    });
    // 滚动到底部
    if(messages.length > 0){
        $('#chatWindow').scrollTop($('#chatWindow')[0].scrollHeight);
    }
}

let last_emoji_id = -1;
function updateEmojis(emojis) {
    if (last_emoji_id === -1) {
        last_emoji_id = emojis;
        return;
    }
    // 显示emoji表情
    const container = $("#boardContainer");
    container.find("img.emoji").each(function(_, img) {
        const timestamp = new Date(img.timestamp);
        const now = new Date();
        if (now - timestamp > 2000) {
            img.remove();
        }
    });
    emojis.forEach(emoji => {
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
        img[0].timestamp = new Date();
        container.append(img);
        last_emoji_id = emoji.id;
    });
}

// 发送聊天消息
function sendChatMessage() {
    const content = $('#chatInput').val().trim();
    if (content) {
        $('#chatInput').blur();
        ajaxWithLoading({
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
    $('#emojiPopup').hide();
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
        postWithLoading(`/api/take_seat/${roomId}/${seat}`, {}, function(response) {
            if (response.status !== 'success') {
                alert(response.message);
            }
        });
    });
    
    // 离座按钮
    $('.leave-btn').click(function() {
        const seat = $(this).data('seat');
        if(!isActive || confirm('当前游戏正在进行中，离座将会退出游戏。确定要离座吗？')){
            ajaxWithLoading({
                url: `/api/leave_seat/${roomId}/${seat}`,
                type: 'POST',
                async: false,
                success: function(response) {
                    if (response.status !== 'success') {
                        alert(response.message);
                    }
                }
            });
        }
    });
    
    // 踢人按钮
    $('.kick-btn').click(function() {
        const seat = $(this).data('seat');
        if (confirm('确定要踢出该玩家吗？')) {
            postWithLoading(`/api/kick_player/${roomId}/${seat}`, {}, function(response) {
                if (response.status !== 'success') {
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
        ajaxWithLoading({
            url: `/api/change_room_type/${roomId}`,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ room_type: parseInt(newType) }),
            success: function(response) {
                if (response.status !== 'success') {
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
    postWithLoading(`/api/start_game/${roomId}`, {}, function(response) {
        if (response.status !== 'success') {
            alert(response.message);
        }
    });
});

// 结束游戏
$('#EndGameBtn').click(function() {
    if (confirm('确定要结束当前游戏吗？')) {
        postWithLoading(`/api/stop_game/${roomId}`, {}, function(response) {
            if (response.status !== 'success') {
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

    const [old_x, old_y] = [chessMap[selectedId].position().left, chessMap[selectedId].position().top];
    if (allowedToMove || confirm('当前不是您的回合，确定要移动吗？')) {
        ajaxWithLoading({
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
                    drawArrow([old_x, old_y, x, y]); // 确认移动后画一次箭头
                }
            }
        });
    }

    // 移动后取消选中
    chessMap[selectedId].removeClass("border-3 border-dark");
    selectedId = null;
});

function respondToAttack(accept) {
    ajaxWithLoading({
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
            } else {
                $('#attackPopup').hide();
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
    
    ajaxWithLoading({
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

// 和服务器交互
let last_record_id = -1;
function updateRoomStatusAll() {
    let pingStart = new Date();
    $.ajax({
        url: `/api/room_status/${roomId}`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            last_msg_id: last_msg_id,
            last_emoji_id: last_emoji_id,
            last_record_id: last_record_id
        }),
        success: function(data) {
            updateRoomStatus(data.status);
            updateChatMessages(data.messages);
            updateEmojis(data.emojis);
            if(isActive){
                if (data.board) {
                    updateBoard(data.board.board, data.board.next_player);
                    last_record_id = data.board.record_id;
                }
                updateBattle(data.status.battle);
                updateTags();
            }else{
                // 清除棋盘
                Object.values(chessMap).forEach(el => el.remove());
                chessMap = {};
                selectedId = null;
                $("#arrowLayer").find("line").remove();
                $('.round-indicator').hide();
                clearInterval(roundTickingInterval);
            }
            let pingEnd = new Date();
            let ping = parseInt(pingEnd - pingStart);
            let red = Math.min(Math.max(0, Math.floor((ping - 200) / 3)), 255);
            $('#ping').text(ping + ' ms');
            $('#ping').css('color', `rgb(${red}, ${255 - red}, 0)`);
            setTimeout(updateRoomStatusAll, Math.max(200 - ping, 0));
        },
        error: function() {
            $('#ping').text('离线');
            $('#ping').css('color', 'red');
            setTimeout(updateRoomStatusAll, 200);
        }
    });
}
$(document).ready(function() {
    updateRoomStatusAll();
});
