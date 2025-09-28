function updateReplay(step) {
    const container = $("#boardContainer");
    const arrowLayer = $("#arrowLayer");
    let board = JSON.parse(records[step - 1]);
    
  // 更新棋子
    board.chesses.forEach(chess => {
        let el = chessMap[chess.id];
        if (!el) {
            // 新建棋子节点 (Bootstrap 风格圆形按钮)
            el = $(`<div class="btn btn-sm rounded-circle border fw-bold chess"></div>`);
            container.append(el);
            chessMap[chess.id] = el;
            el.text(chess.name); 
            // 设置不同队伍颜色
            el.css("background-color", colors[chess.team]);
        }
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
        const [old_x, old_y, new_x, new_y] = board.last_move;
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

    if (board.last_battle_result) {
        let soundStr = Array.isArray(board.last_battle_result) ? board.last_battle_result[0] : board.last_battle_result;
        $('#' + soundStr + 'Sound')[0].play();
    } else {
        $('#moveSound')[0].play();
    }

    $('#currentStep').text(step);
}
updateReplay(1); // 初始化显示第一步

function startAutoPlay() {
    $('#playPauseBtn').removeClass('fa-play').addClass('fa-pause');
    autoPlayInterval = setInterval(() => {
        let rangeInput = $('#replayRange')[0];
        let currentValue = parseInt(rangeInput.value);
        if (currentValue < parseInt(rangeInput.max)) {
            rangeInput.value = currentValue + 1;
            updateReplay(rangeInput.value);
        } else {
            stopAutoPlay();
        }
    }, 1000);
}

function stopAutoPlay() {
    $('#playPauseBtn').removeClass('fa-pause').addClass('fa-play');
    clearInterval(autoPlayInterval);
}

function playPause() {
    if ($('#playPauseBtn').hasClass('fa-play')) {
        if ($('#replayRange').val() == $('#replayRange').attr('max')) {
            $('#replayRange').val(1);
            updateReplay(1);
        }
        startAutoPlay();
    } else {
        stopAutoPlay();
    }
}

function prevStep() {
    stopAutoPlay();
    let rangeInput = $('#replayRange')[0];
    let currentValue = parseInt(rangeInput.value);
    if (currentValue > 1) {
        rangeInput.value = currentValue - 1;
        updateReplay(rangeInput.value);
    }
}

function nextStep() {
    stopAutoPlay();
    let rangeInput = $('#replayRange')[0];
    let currentValue = parseInt(rangeInput.value);
    if (currentValue < parseInt(rangeInput.max)) {
        rangeInput.value = currentValue + 1;
        updateReplay(rangeInput.value);
    }
}