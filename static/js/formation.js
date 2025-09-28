let formations = localStorage.getItem('formations') ? JSON.parse(localStorage.getItem('formations')) : [];
let selectedIdx = -1;
const defaultFormation = [
    '兵', '排', '团', '连', '雷', '弹',
    '营', '', '旅', '', '师', '旗',
    '兵', '排', '', '连', '雷', '军',
    '营', '', '旅', '', '师', '司',
    '兵', '排', '团', '连', '雷', '弹'
];
const ROWS = 6, COLS = 5;
const forbiddenPoints = [[1,1],[1,3],[2,2],[3,1],[3,3]];
const flagPoints = [[5,1],[5,3]];
function saveFormations() {
    localStorage.setItem('formations', JSON.stringify(formations));
}
// 阵型列表渲染
function renderFormationList() {
    $('#formation-list').empty();
    formations.forEach((f,i)=>{
        $('#formation-list').append(
            `<li class="list-group-item d-flex align-items-center formation-item${i===selectedIdx?' active':''}" data-index="${i}">
            <i class="fas fa-edit me-2 text-primary"></i>
            <input type="text" class="form-control form-control-sm formation-name me-2 flex-grow-1" value="${f.name}">
            <button class="btn btn-secondary btn-sm copy-formation me-1"><i class="fas fa-copy"></i></button>
            <button class="btn btn-danger btn-sm delete-formation"><i class="fas fa-trash"></i></button>
            </li>`
        );
    });
    $('#formation-list').append(
        `<li class="list-group-item d-flex align-items-center">
            <input type="text" class="form-control form-control-sm new-formation-name me-2 flex-grow-1" placeholder="添加阵型名称">
            <button class="btn btn-success btn-sm add-formation"><i class="fas fa-plus"></i></button>
        </li>`
    );
}
// 改名
$('#formation-list').on('input propertychange', '.formation-name', function(){
    let idx = $(this).closest('.formation-item').data('index');
    formations[idx].name = $(this).val();
    saveFormations();
});
// 复制
$('#formation-list').on('click', '.copy-formation', function(e){
    e.stopPropagation();
    let idx = $(this).closest('.formation-item').data('index');
    let copy = JSON.parse(JSON.stringify(formations[idx]));
    copy.name += ' - 副本';
    formations.push(copy);
    selectedIdx = formations.length-1;
    saveFormations();
    refresh();
});
// 删除
$('#formation-list').on('click', '.delete-formation', function(e){
    e.stopPropagation();
    if (confirm('确定删除该阵型吗？')) {
        let idx = $(this).closest('.formation-item').data('index');
        formations.splice(idx,1);
        if (idx == selectedIdx) {
            selectedIdx = -1;
        } else if (idx < selectedIdx) {
            selectedIdx -= 1;
        }
        saveFormations();
        refresh();
    }
});
// 添加
$('#formation-list').on('click', '.add-formation', function(){
    let name = $(this).siblings('.new-formation-name').val().trim();
    formations.push({name, matrix:JSON.parse(JSON.stringify(defaultFormation))});
    selectedIdx = formations.length-1;
    saveFormations();
    refresh();
});
// 选中
$('#formation-list').on('click', '.formation-item', function(){
    $('#formation-list .formation-item').removeClass('active');
    selectedIdx = Number($(this).data('index'));
    $(this).addClass('active');
    renderMatrix();
});
function renderMatrix() {
    $('#matrix').empty();
    if(selectedIdx == -1) return;
    const matrix = formations[selectedIdx].matrix;
    for(let r=0;r<ROWS;r++){
        let row = $('<div class="d-flex justify-content-center mb-2"></div>');
        for(let c=0;c<COLS;c++){
            let idx = c*ROWS+r;
            let forbidden = forbiddenPoints.some(([fr,fc])=>fr===r&&fc===c);
            let val = matrix[idx];
            row.append(`<button class="btn btn-outline-dark rounded-circle mx-1 dot-btn"
                style="width:50px;height:50px;font-size:1.6rem;font-weight:bold;
                ${forbidden?'background:#ccc;pointer-events:none;':''}"
                data-idx="${idx}">${val}</button>`);
        }
        $('#matrix').append(row);
    }
}
let swapFirst = null;
$('#matrix').on('click', '.dot-btn', function(){
    let idx = Number($(this).data('idx'));
    if(swapFirst === null){
        swapFirst = idx;
        $(this).addClass('btn-info');
        $('#selectSound')[0].play();
    }else if(swapFirst === idx){
        swapFirst = null;
        $(this).removeClass('btn-info');
    }else{
        let m = formations[selectedIdx].matrix;
        let temp = m[swapFirst];
        m[swapFirst] = m[idx];
        m[idx] = temp;
        swapFirst = null;
        saveFormations(formations);
        refresh();
        $('#moveSound')[0].play();
    }
});
function refresh() {
    renderFormationList();
    renderMatrix();
}
refresh();
function randomFormation() {
    if(selectedIdx == -1) return;
    let pieces = defaultFormation.filter(p=>p && p !== '旗' && p !== '雷' && p !== '弹');
    formations[selectedIdx].matrix.fill('');
    let [r,c] = flagPoints[Math.floor(Math.random()*flagPoints.length)];
    formations[selectedIdx].matrix[c*ROWS+r] = '旗';
    for(let i=0;i<3;){
        let [r,c] = [Math.floor(Math.random()*2)+4, Math.floor(Math.random()*COLS)];
        if(formations[selectedIdx].matrix[c*ROWS+r] !== '') continue;
        formations[selectedIdx].matrix[c*ROWS+r] = '雷';
        i++;
    }
    for(let i=0;i<2;){
        let [r,c] = [Math.floor(Math.random()*5)+1, Math.floor(Math.random()*COLS)];
        if(formations[selectedIdx].matrix[c*ROWS+r] !== '') continue;
        if(forbiddenPoints.some(([fr,fc])=>fr===r&&fc===c)) continue;
        formations[selectedIdx].matrix[c*ROWS+r] = '弹';
        i++;
    }
    pieces = pieces.sort(()=>Math.random()-0.5);
    let idx = 0;
    for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
            if(formations[selectedIdx].matrix[c*ROWS+r] !== '') continue;
            if(forbiddenPoints.some(([fr,fc])=>fr===r&&fc===c)) continue;
            formations[selectedIdx].matrix[c*ROWS+r] = pieces[idx++];
        }
    }
    saveFormations();
    refresh();
}