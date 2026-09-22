/**
 * 教培工作台 - 主应用逻辑
 * 全局 API（从 window 读取）
 */

const { studentsAPI, subjectsAPI, plansAPI, reportsAPI, summariesAPI, assessmentsAPI, weekStatsAPI, dailyNotesAPI } = window;

// 全局状态
const state = {
  students: [],
  subjects: [],
  plans: [],
  currentDate: new Date().toISOString().split('T')[0],
  selectedStudentId: null,
  selectedSubjectId: null,
  currentStudentId: null
};

// 路由控制
const router = {
  pages: ['home', 'students', 'plans', 'subjects', 'correct', 'summary', 'profile'],

  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`${page}Page`);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navMap = { home: 0, students: 1, plans: 2, summary: 3 };
    if (navMap[page] !== undefined) {
      document.querySelectorAll('.nav-item')[navMap[page]]?.classList.add('active');
    }

    if (page === 'home') initHomePage();
    if (page === 'students') initStudentsPage();
    if (page === 'plans') initPlansPage();
    if (page === 'correct') initCorrectPage();
    if (page === 'summary') initSummaryPage();
    if (page === 'profile') initProfilePage();

    window.scrollTo(0, 0);
  }
};

// 模态框控制
const modal = {
  show(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalContainer').style.display = 'flex';
  },

  close() {
    document.getElementById('modalContainer').style.display = 'none';
  }
};

// Toast 提示
const toast = {
  show(message, type = 'info') {
    const toastEl = document.getElementById('toast');
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => toastEl.classList.remove('show'), 2500);
  },
  success(message) { this.show(message, 'success'); },
  error(message) { this.show(message, 'error'); }
};

// 加载状态
const loading = {
  show(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loading').style.display = 'flex';
  },
  hide() {
    document.getElementById('loading').style.display = 'none';
  }
};

// 工具函数
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success('已复制到剪贴板');
  }).catch(() => {
    toast.error('复制失败，请手动复制');
  });
}

// 页面初始化：先判定登录态，未登录只显示登录页
async function initApp() {
  let user = null;
  try {
    user = await authAPI.getCurrentUser();
  } catch (error) {
    console.error('读取登录状态失败:', error);
  }

  // 会话被服务端判定失效（如后台改密码）时自动退回登录页
  authAPI.onAuthChange(currentUser => {
    if (!currentUser) showLogin();
  });

  user ? enterApp(user) : showLogin();
}

function showLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
}

// 登录成功：清空表单并加载业务数据
async function enterApp(user) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('loginPage').querySelector('form').reset();
  document.getElementById('app').style.display = '';

  document.getElementById('userName').textContent = (user.email || '').split('@')[0];

  const today = new Date();
  document.getElementById('todayDate').textContent =
    `${today.getMonth() + 1}月${today.getDate()}日 ${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

  await loadAllData();
  initHomePage();
}

// 提交登录
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginSubmit');

  errorEl.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = '登录中...';

  try {
    const { user } = await authAPI.signIn(email, password);
    await enterApp(user);
  } catch (error) {
    console.error('登录失败:', error);
    errorEl.textContent = error.message || '登录失败，请检查邮箱和密码';
    submitBtn.disabled = false;
    submitBtn.textContent = '登 录';
  }
}

// 退出登录
async function handleLogout() {
  try {
    await authAPI.signOut();
  } catch (error) {
    console.error('退出失败:', error);
  }
  state.students = [];
  state.subjects = [];
  state.plans = [];
  showLogin();
}

// 标准科目清单（初中九科）
const DEFAULT_SUBJECTS = [
  { name: '语文', icon: '📖' },
  { name: '数学', icon: '📐' },
  { name: '英语', icon: '📝' },
  { name: '物理', icon: '🧲' },
  { name: '化学', icon: '🧪' },
  { name: '生物', icon: '🧬' },
  { name: '地理', icon: '🌍' },
  { name: '历史', icon: '📜' },
  { name: '道法', icon: '⚖️' }
];

// 补齐缺失的标准科目：已存在的按名称跳过，可重复执行
async function ensureDefaultSubjects() {
  const existing = new Set(state.subjects.map(s => s.name));
  const missing = DEFAULT_SUBJECTS.filter(s => !existing.has(s.name));

  for (const subj of missing) {
    try {
      const { subject } = await subjectsAPI.create(subj);
      state.subjects.push(subject);
    } catch (error) {
      console.error(`创建科目「${subj.name}」失败:`, error);
    }
  }
}

async function loadAllData() {
  try {
    const studentsRes = await studentsAPI.list();
    state.students = studentsRes.students || [];

    const subjectsRes = await subjectsAPI.list();
    state.subjects = subjectsRes.subjects || [];

    await ensureDefaultSubjects();
  } catch (error) {
    console.error('加载数据失败:', error);
    toast.error('数据加载失败，请刷新重试');
  }
}

// 首页初始化
function initHomePage() {
  // 回到首页时，强制把日期锁回今天（避免规划/总结页改了日期回来仍是旧日期）
  state.currentDate = new Date().toISOString().split('T')[0];
  updateQuickList();
}

async function updateQuickList() {
  const quickList = document.getElementById('quickList');
  const dateLabel = document.getElementById('quickListDate');
  if (dateLabel) dateLabel.textContent = state.currentDate;

  try {
    const [plansRes, studentsRes] = await Promise.all([
      plansAPI.list({ date: state.currentDate }),
      studentsAPI.list()
    ]);
    const plans = plansRes.plans || [];
    const students = studentsRes.students || [];

    // 1. 收集今天有规划的科目（按创建顺序，休息不进表）
    const subjectOrder = [];
    const subjectMap = new Map();
    plans.forEach(p => {
      const subj = p.subject;
      if (!subj || subj.is_break) return;
      if (!subjectMap.has(subj.id)) {
        subjectMap.set(subj.id, subj);
        subjectOrder.push(subj);
      }
    });

    // 2. 按学生聚合到科目
    const byStudent = new Map();
    plans.forEach(p => {
      if (!p.student) return;
      if (!byStudent.has(p.student.id)) byStudent.set(p.student.id, new Map());
      if (p.subject && !p.subject.is_break) {
        byStudent.get(p.student.id).set(p.subject.id, p);
      }
    });

    if (subjectOrder.length === 0) {
      quickList.innerHTML = '<p class="empty-tip">今日暂无规划</p>';
      return;
    }

    // 3. 表头
    const headHtml = `
      <tr>
        <th class="quick-th-student">学生</th>
        ${subjectOrder.map(s => `<th class="quick-th-subject">${s.icon || ''}<br><span class="quick-th-subject-name">${s.name}</span></th>`).join('')}
      </tr>`;

    // 4. 行：有规划的学生才展示，按中文名排序
    const sortedStudents = students.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    let bodyHtml = '';
    let hasAnyRow = false;
    sortedStudents.forEach(stu => {
      const stuPlans = byStudent.get(stu.id);
      if (!stuPlans || stuPlans.size === 0) return;
      hasAnyRow = true;
      bodyHtml += `<tr><td class="quick-td-name">${stu.name}</td>`;
      subjectOrder.forEach(subj => {
        const plan = stuPlans.get(subj.id);
        if (plan) {
          const tip = plan.start_time && plan.end_time ? `title="${plan.start_time}-${plan.end_time}"` : '';
          bodyHtml += `<td class="quick-td-status ${plan.is_completed ? 'is-done' : 'is-pending'}"
                          onclick="router.navigate('plans')" ${tip}>
                         ${plan.is_completed ? '✅' : '⬜'}
                       </td>`;
        } else {
          bodyHtml += '<td class="quick-td-empty">—</td>';
        }
      });
      bodyHtml += '</tr>';
    });

    if (!hasAnyRow) {
      quickList.innerHTML = '<p class="empty-tip">今日暂无规划</p>';
      return;
    }

    quickList.innerHTML = `
      <div class="quick-table-wrap">
        <table class="quick-table">
          <thead>${headHtml}</thead>
          <tbody>${bodyHtml}</tbody>
        </table>
        <p class="quick-table-legend"><span class="is-done">✅</span> 已完成 <span class="is-pending">⬜</span> 待完成</p>
      </div>
    `;
  } catch (error) {
    console.error('加载待办失败:', error);
    quickList.innerHTML = '<p class="empty-tip">加载失败</p>';
  }
}

// 学生管理页面
async function initStudentsPage() {
  await loadStudents();
}

async function loadStudents() {
  const listEl = document.getElementById('studentsList');

  if (state.students.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👨‍🎓</div>
        <p class="empty-state-text">暂无学生，点击右上角添加</p>
      </div>
    `;
    return;
  }

  let html = '';
  state.students.forEach(student => {
    html += `
      <div class="list-item" onclick="profile.open('${student.id}')">
        <div class="list-item-info">
          <div class="list-item-avatar">🎓</div>
          <div>
            <div class="list-item-name">${student.name}</div>
            <div class="list-item-desc">${student.grade || ''} ${student.group_name || ''}</div>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="list-item-btn" onclick="event.stopPropagation(); students.showEditModal('${student.id}')">✏️</button>
          <button class="list-item-btn" onclick="event.stopPropagation(); students.confirmDelete('${student.id}')">🗑️</button>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

const students = {
  showAddModal() {
    modal.show('添加学生', `
      <div class="modal-form">
        <div class="form-item">
          <label>姓名 *</label>
          <input type="text" id="studentName" placeholder="请输入学生姓名">
        </div>
        <div class="form-item">
          <label>年级</label>
          <input type="text" id="studentGrade" placeholder="如：五年级">
        </div>
        <div class="form-item">
          <label>家长群名称</label>
          <input type="text" id="studentGroup" placeholder="如：XX妈妈群">
        </div>
        <div class="form-item">
          <label>入学日期</label>
          <input type="date" id="studentEnrolledAt">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="students.save()">保存</button>
        </div>
      </div>
    `);
  },

  showEditModal(id) {
    const student = state.students.find(s => s.id === id);
    if (!student) return;

    modal.show('编辑学生', `
      <div class="modal-form">
        <div class="form-item">
          <label>姓名 *</label>
          <input type="text" id="studentName" value="${student.name}">
        </div>
        <div class="form-item">
          <label>年级</label>
          <input type="text" id="studentGrade" value="${student.grade || ''}">
        </div>
        <div class="form-item">
          <label>家长群名称</label>
          <input type="text" id="studentGroup" value="${student.group_name || ''}">
        </div>
        <div class="form-item">
          <label>入学日期</label>
          <input type="date" id="studentEnrolledAt" value="${student.enrolled_at || ''}">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="students.save('${id}')">保存</button>
        </div>
      </div>
    `);
  },

  async save(id) {
    const name = document.getElementById('studentName').value.trim();
    const grade = document.getElementById('studentGrade').value.trim();
    const group_name = document.getElementById('studentGroup').value.trim();
    // 空字符串会被 Postgres 判为非法日期，必须转成 null
    const enrolled_at = document.getElementById('studentEnrolledAt').value || null;

    if (!name) {
      toast.error('请输入学生姓名');
      return;
    }

    loading.show('保存中...');

    try {
      if (id) {
        await studentsAPI.update(id, { name, grade, group_name, enrolled_at });
        toast.success('修改成功');
      } else {
        await studentsAPI.create({ name, grade, group_name, enrolled_at });
        toast.success('添加成功');
      }

      modal.close();
      await loadStudents();
      await loadAllData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  confirmDelete(id) {
    const student = state.students.find(s => s.id === id);
    if (!student) return;

    if (confirm(`确定要删除学生"${student.name}"吗？`)) {
      this.delete(id);
    }
  },

  async delete(id) {
    loading.show('删除中...');

    try {
      await studentsAPI.delete(id);
      toast.success('删除成功');
      await loadStudents();
      await loadAllData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  }
};

// 作业规划页面
async function initPlansPage() {
  document.getElementById('planDate').textContent = formatDate(state.currentDate);
  updateStudentSelect('planStudentSelect');
  updateStudentSelect('correctStudentSelect');
  updateSubjectSelect('correctSubjectSelect');
  // 默认选中第一个学生，避免"请先选择学生"提示造成误解
  const planSel = document.getElementById('planStudentSelect');
  if (planSel && !planSel.value && state.students.length > 0) planSel.value = state.students[0].id;
  await dailyNotes.load(planSel?.value, state.currentDate);
  await loadPlans();
}

function updateStudentSelect(selectId) {
  const select = document.getElementById(selectId);
  let html = '<option value="">请选择学生</option>';
  state.students.forEach(student => {
    html += `<option value="${student.id}">${student.name}</option>`;
  });
  select.innerHTML = html;
}

function updateSubjectSelect(selectId) {
  const select = document.getElementById(selectId);
  let html = '<option value="">请选择科目</option>';
  state.subjects.forEach(subject => {
    html += `<option value="${subject.id}">${subject.icon} ${subject.name}</option>`;
  });
  select.innerHTML = html;
}

// ========== 学生每日共享备注（核心策略 / 今日预计规划） ==========
const dailyNotes = {
  // 加载并填充到顶部两个 textarea
  async load(studentId, date) {
    const wrap = document.getElementById('dailyNotesWrap');
    if (!wrap) return;
    if (!studentId) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';
    document.getElementById('dailyNotesDate').textContent = date;

    try {
      const { note } = await dailyNotesAPI.get(studentId, date);
      document.getElementById('dailyCoreStrategy').value = note?.core_strategy || '';
      document.getElementById('dailyTodayPlan').value    = note?.today_plan || '';
      document.getElementById('dailyNotesStatus').textContent = note ? '已保存' : '未填写';
    } catch (error) {
      console.error('加载每日备注失败:', error);
    }
  },

  async save() {
    const studentId = document.getElementById('planStudentSelect').value;
    if (!studentId) { toast.error('请先选择学生'); return; }
    const coreStrategy = document.getElementById('dailyCoreStrategy').value.trim() || null;
    const todayPlan    = document.getElementById('dailyTodayPlan').value.trim() || null;
    loading.show('保存中...');
    try {
      await dailyNotesAPI.upsert(studentId, state.currentDate, { core_strategy: coreStrategy, today_plan: todayPlan });
      document.getElementById('dailyNotesStatus').textContent = '已保存';
      toast.success('已保存今日备注');
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  }
};

async function loadPlans() {
  const studentId = document.getElementById('planStudentSelect').value;
  const listEl = document.getElementById('plansList');

  if (!studentId) {
    listEl.innerHTML = '<p class="empty-tip" style="text-align:center;padding:20px;">请先选择学生</p>';
    return;
  }

  loading.show('加载中...');

  try {
    // 切换学生 / 日期时同步加载每日备注
    await dailyNotes.load(studentId, state.currentDate);

    const res = await plansAPI.list({
      date: state.currentDate,
      student_id: studentId
    });

    state.plans = res.plans || [];

    if (state.plans.length === 0) {
      listEl.innerHTML = '<p class="empty-tip" style="text-align:center;padding:20px;">暂无规划，点击下方添加科目</p>';
      return;
    }

    let html = '';
    state.plans.forEach(plan => {
      const subjectIcon = plan.subject?.icon || '📝';
      const subjectName = plan.subject?.name || '未知';
      const timeRange = plan.start_time && plan.end_time
        ? `${plan.start_time}-${plan.end_time}`
        : '未设置时间';
      const LESSON_TYPE_MAP = Object.fromEntries(window.LESSON_TYPES.map(t => [t.value, t.label]));
      const lessonLabel = LESSON_TYPE_MAP[plan.lesson_type] || '作业';
      const isBreak = plan.subject?.is_break;
      const duration = plan.duration_minutes || (plan.start_time && plan.end_time ? minutesBetween(plan.start_time, plan.end_time) : 0);
      const durationText = duration ? `${duration} 分钟` : '';
      const strategyHtml = '';
      const todayPlanHtml = '';

      html += `
        <div class="plan-item ${isBreak ? 'plan-item-break' : ''}">
          <div class="plan-item-left">
            <span class="plan-item-icon">${subjectIcon}</span>
            <div class="plan-item-info">
              <h4>${subjectName} <em class="lesson-tag ${plan.lesson_type}">${lessonLabel}</em></h4>
              <p>${timeRange}${durationText ? ' · 计划用时 ' + durationText : ''}</p>
              ${strategyHtml}
              ${todayPlanHtml}
            </div>
          </div>
          <div class="plan-item-status">
            <span class="status-tag ${plan.is_completed ? 'completed' : 'pending'}"
                  onclick="plans.toggleComplete('${plan.id}', ${!plan.is_completed})">
              ${plan.is_completed ? '✅已完成' : '⬜未完成'}
            </span>
            <button class="list-item-btn" onclick="plans.deletePlan('${plan.id}')">🗑️</button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  } catch (error) {
    toast.error('加载规划失败');
    console.error(error);
  } finally {
    loading.hide();
  }
}

const plans = {
  changeDate(delta) {
    const date = new Date(state.currentDate);
    date.setDate(date.getDate() + delta);
    state.currentDate = date.toISOString().split('T')[0];
    document.getElementById('planDate').textContent = formatDate(state.currentDate);
    loadPlans();
  },

  showManageSubjects() {
    router.navigate('subjects');
  },

  showAddPlan() {
    const studentId = document.getElementById('planStudentSelect').value;

    if (!studentId) {
      toast.error('请先选择学生');
      return;
    }

    // 15 分钟间隔
    let timeOptions = '';
    for (let h = 8; h <= 22; h++) {
      for (let m = 0; m < 60; m += 15) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        timeOptions += `<option value="${time}">${time}</option>`;
      }
    }

    let subjectOptions = '';
    state.subjects.forEach(subject => {
      subjectOptions += `<option value="${subject.id}">${subject.icon} ${subject.name}</option>`;
    });

    const lessonTypeOptions = window.LESSON_TYPES.map(lt =>
      `<option value="${lt.value}">${lt.label}</option>`
    ).join('');

    modal.show('添加规划', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目 *</label>
          <select id="planSubject" onchange="plans._onSubjectChange()">${subjectOptions}</select>
        </div>
        <div class="form-item">
          <label>课型 *</label>
          <select id="planLessonType">${lessonTypeOptions}</select>
        </div>
        <div class="form-item time-row">
          <div class="time-col">
            <label>开始时间</label>
            <select id="planStartTime" onchange="plans._onTimeChange()">${timeOptions}</select>
          </div>
          <div class="time-col">
            <label>结束时间</label>
            <select id="planEndTime" onchange="plans._onTimeChange()">${timeOptions}</select>
          </div>
          <div class="time-col time-duration">
            <label>计划用时</label>
            <span id="planDuration" class="duration-display">—</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="plans.save()">添加</button>
        </div>
      </div>
    `);

    // 默认选中第一个非休息科目 + 配套课型
    const sel = document.getElementById('planSubject');
    if (sel) sel.selectedIndex = 0;
    this._onSubjectChange();
  },

  // 选了科目后，课型下拉只保留该科目允许的项
  _onSubjectChange() {
    // 不再按科目过滤课型：所有课型始终全量展示，老师自由选择
    const sel = document.getElementById('planLessonType');
    sel.innerHTML = window.LESSON_TYPES
      .map(lt => `<option value="${lt.value}">${lt.label}</option>`).join('');
    this._onTimeChange();
  },

  // 根据 start_time/end_time 自动算计划用时
  _onTimeChange() {
    const s = document.getElementById('planStartTime').value;
    const e = document.getElementById('planEndTime').value;
    const out = document.getElementById('planDuration');
    if (!out) return;
    if (!s || !e || e <= s) { out.textContent = '—'; return; }
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    out.textContent = minutes >= 60 ? `${(minutes / 60).toFixed(1)} 小时（${minutes} 分钟）` : `${minutes} 分钟`;
  },

  async save() {
    const studentId = document.getElementById('planStudentSelect').value;
    const subjectId = document.getElementById('planSubject').value;
    const lessonType = document.getElementById('planLessonType').value;
    const startTime = document.getElementById('planStartTime').value;
    const endTime = document.getElementById('planEndTime').value;

    if (!subjectId) {
      toast.error('请选择科目');
      return;
    }
    if (!startTime || !endTime) {
      toast.error('请选择开始和结束时间');
      return;
    }
    if (endTime <= startTime) {
      toast.error('结束时间必须晚于开始时间');
      return;
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);

    loading.show('添加中...');

    try {
      await plansAPI.create({
        student_id: studentId,
        subject_id: subjectId,
        plan_date: state.currentDate,
        lesson_type: lessonType,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes
      });

      toast.success('添加成功');
      modal.close();
      await loadPlans();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  async toggleComplete(id, isCompleted) {
    try {
      await plansAPI.toggleComplete(id, isCompleted);
      await loadPlans();
      toast.success(isCompleted ? '已标记为完成' : '已标记为未完成');
    } catch (error) {
      toast.error('操作失败');
    }
  },

  async deletePlan(id) {
    if (!confirm('确定要删除这条规划吗？')) return;

    loading.show('删除中...');

    try {
      await plansAPI.delete(id);
      toast.success('删除成功');
      await loadPlans();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  async copyPlans() {
    const studentId = document.getElementById('planStudentSelect').value;
    const student = state.students.find(s => s.id === studentId);

    if (!student || state.plans.length === 0) {
      toast.error('没有可复制的规划');
      return;
    }

    const LESSON_TYPE_MAP = Object.fromEntries(window.LESSON_TYPES.map(t => [t.value, t.label]));

    let text = `【${student.name} 今日作业规划】${formatFullDate(state.currentDate)}\n\n`;

    state.plans.forEach(plan => {
      const icon = plan.subject?.icon || '📝';
      const name = plan.subject?.name || '未知';
      const lessonType = LESSON_TYPE_MAP[plan.lesson_type] || '作业';
      const hasTime = plan.start_time && plan.end_time;
      const time = hasTime ? `${plan.start_time}-${plan.end_time}` : '未安排';
      const duration = hasTime ? `${plan.duration_minutes || minutesBetween(plan.start_time, plan.end_time)} 分钟` : '未安排';

      // 例：📐 数学 16:00-16:45 · 作业 · 计划用时 45 分钟 · 已完成 ✅
      text += `${icon} ${name} ${time} · ${lessonType} · 计划用时 ${duration}`;
      if (plan.is_completed) text += ` · 已完成 ✅`;
      text += `\n`;
    });

    // 规划条目之后追加今日共享备注（核心策略 / 今日预计规划）
    try {
      const { note } = await dailyNotesAPI.get(studentId, state.currentDate);
      if (note && (note.core_strategy || note.today_plan)) {
        text += '\n';
        if (note.core_strategy) text += `🎯 核心策略：${note.core_strategy}\n`;
        if (note.today_plan)    text += `📝 今日预计规划：${note.today_plan}\n`;
      }
    } catch (e) { /* 备注缺失不影响复制 */ }

    copyToClipboard(text);
  }
};

function minutesBetween(start, end) {
  if (!start || !end || end <= start) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// 科目管理页面
async function initSubjectsPage() {
  await loadSubjects();
}

async function loadSubjects() {
  const listEl = document.getElementById('subjectsList');

  if (state.subjects.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        <p class="empty-state-text">暂无科目，点击右上角添加</p>
      </div>
    `;
    return;
  }

  let html = '';
  state.subjects.forEach(subject => {
    html += `
      <div class="list-item">
        <div class="list-item-info">
          <span style="font-size:24px">${subject.icon}</span>
          <div class="list-item-name">${subject.name}</div>
        </div>
        <div class="list-item-actions">
          <button class="list-item-btn" onclick="subjects.showEditModal('${subject.id}')">✏️</button>
          <button class="list-item-btn" onclick="subjects.confirmDelete('${subject.id}')">🗑️</button>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

const subjects = {
  // 渲染图标选择器
  _renderIcons(selectedIcon) {
    const icons = ['📐', '📝', '📖', '🔬', '⚡', '🧪', '🎨', '🎵', '🏀', '🗣️', '💻', '🌍', '☕', '🍱', '⏸️'];
    return icons.map(icon =>
      `<div class="icon-option ${icon === selectedIcon ? 'active' : ''}" data-icon="${icon}">${icon}</div>`
    ).join('');
  },

  showAddModal() {
    modal.show('添加科目', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目名称 *</label>
          <input type="text" id="subjectName" placeholder="如：数学 / 休息">
        </div>
        <div class="form-item">
          <label>选择图标</label>
          <div class="icon-picker" id="iconPicker">${this._renderIcons('📝')}</div>
        </div>
        <div class="form-item">
          <label>
            <input type="checkbox" id="subjectIsBreak">
            标记为休息科目
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save()">保存</button>
        </div>
      </div>
    `);
    this._bindIconPicker();
  },

  showEditModal(id) {
    const subject = state.subjects.find(s => s.id === id);
    if (!subject) return;

    modal.show('编辑科目', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目名称 *</label>
          <input type="text" id="subjectName" value="${subject.name}">
        </div>
        <div class="form-item">
          <label>选择图标</label>
          <div class="icon-picker" id="iconPicker">${this._renderIcons(subject.icon || '📝')}</div>
        </div>
        <div class="form-item">
          <label>
            <input type="checkbox" id="subjectIsBreak" ${subject.is_break ? 'checked' : ''}>
            标记为休息科目
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save('${id}')">保存</button>
        </div>
      </div>
    `);
    this._bindIconPicker();
  },

  _bindIconPicker() {
    document.querySelectorAll('.icon-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('active'));
        el.classList.add('active');
      });
    });
  },

  async save(id) {
    const name = document.getElementById('subjectName').value.trim();
    const activeIcon = document.querySelector('.icon-option.active');
    const icon = activeIcon ? activeIcon.dataset.icon : '📝';
    const isBreak = document.getElementById('subjectIsBreak').checked;

    if (!name) {
      toast.error('请输入科目名称');
      return;
    }

    loading.show('保存中...');

    try {
      if (id) {
        await subjectsAPI.update(id, { name, icon, is_break: isBreak });
        toast.success('修改成功');
      } else {
        await subjectsAPI.create({ name, icon, is_break: isBreak });
        toast.success('添加成功');
      }

      modal.close();
      await loadSubjects();
      await loadAllData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  confirmDelete(id) {
    const subject = state.subjects.find(s => s.id === id);
    if (!subject) return;

    if (confirm(`确定要删除科目"${subject.name}"吗？`)) {
      this.delete(id);
    }
  },

  async delete(id) {
    loading.show('删除中...');

    try {
      await subjectsAPI.delete(id);
      toast.success('删除成功');
      await loadSubjects();
      await loadAllData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  }
};

// 拍照批改页面
let selectedImageFile = null;

async function initCorrectPage() {
  updateStudentSelect('correctStudentSelect');
  updateSubjectSelect('correctSubjectSelect');
  document.getElementById('correctResult').style.display = 'none';
}

const correct = {
  triggerUpload() {
    document.getElementById('imageInput').click();
  },

  handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('previewImage');
      const hint = document.querySelector('.upload-hint');
      preview.src = e.target.result;
      preview.style.display = 'block';
      hint.style.display = 'none';
      document.getElementById('correctBtn').disabled = false;
    };
    reader.readAsDataURL(file);
  },

  async startCorrect() {
    toast.error('此功能需要后端支持，请先完成服务器部署');
  },

  reset() {
    selectedImageFile = null;
    document.getElementById('imageInput').value = '';
    document.getElementById('previewImage').style.display = 'none';
    document.querySelector('.upload-hint').style.display = 'block';
    document.getElementById('correctBtn').disabled = true;
    document.getElementById('correctResult').style.display = 'none';
  }
};

// 总结页面：作业情况 / 日常 / 周总结 三个板块
async function initSummaryPage() {
  // 1. 默认作业情况 Tab，但不自动加载（要求手动选学生+点生成）
  if (!summary.currentTab) summary.currentTab = 'homework';
  summary.refreshStudentOptions();
  summary.refreshDateLabels();
  // 默认展示第一个 Tab，但不调用 AI
  summary.switchTab('homework');
}

const summary = {
  currentTab: 'homework',
  dailyAi: '',
  weeklyAi: '',

  // === 通用 ===
  refreshDateLabels() {
    const s = formatDate(state.currentDate);
    const a = document.getElementById('summaryDate');
    const b = document.getElementById('dailyDate');
    if (a) a.textContent = s;
    if (b) b.textContent = s;
  },

  refreshStudentOptions() {
    const opts = '<option value="">请选择学生...</option>' +
      state.students.map(s => `<option value="${s.id}">${s.name}${s.grade ? '（' + s.grade + '）' : ''}</option>`).join('');
    ['homeworkStudent', 'dailyStudent', 'weeklyStudent'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = opts;
    });
    // 重置按钮禁用
    this.onStudentChange(this.currentTab);
  },

  onStudentChange(tabName) {
    const selId = { homework: 'homeworkStudent', daily: 'dailyStudent', weekly: 'weeklyStudent' }[tabName];
    const btnId = { homework: 'homeworkGenerateBtn', daily: 'dailyGenerateBtn', weekly: 'weeklyGenerateBtn' }[tabName];
    const sel = document.getElementById(selId);
    const btn = document.getElementById(btnId);
    if (sel && btn) btn.disabled = !sel.value;
    // 选学生后立即拉历史
    if (sel && sel.value) this.loadHistory(tabName, sel.value);
    else this.loadHistory(tabName, null);
  },

  switchTab(name) {
    this.currentTab = name;
    document.querySelectorAll('.summary-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.summary-tab-panel').forEach(el => { el.hidden = true; });
    const labels = { homework: '作业情况', daily: '日常总结', weekly: '周总结' };
    const panels = { homework: 'tabHomework', daily: 'tabDaily', weekly: 'tabWeekly' };
    const tabBtn = Array.from(document.querySelectorAll('.summary-tab'))
      .find(el => el.textContent.trim() === labels[name]);
    if (tabBtn) tabBtn.classList.add('active');
    document.getElementById(panels[name]).hidden = false;
    this.refreshDateLabels();
  },

  changeDate(delta) {
    const date = new Date(state.currentDate);
    date.setDate(date.getDate() + delta);
    state.currentDate = date.toISOString().split('T')[0];
    this.refreshDateLabels();
  },

  // === 历史记录 ===
  async loadHistory(tabName, studentId) {
    const kind = { homework: 'homework', daily: 'daily', weekly: 'weekly' }[tabName];
    const container = document.getElementById({
      homework: 'homeworkHistory', daily: 'dailyHistory', weekly: 'weeklyHistory'
    }[tabName]);
    if (!container) return;

    try {
      const { items } = await summaryHistoryAPI.list(kind, studentId || null);
      if (!items || items.length === 0) {
        container.innerHTML = '<p class="history-empty">暂无历史记录</p>';
        return;
      }
      container.innerHTML = items.map(item => {
        const dt = new Date(item.created_at);
        const dateStr = dt.toLocaleString('zh-CN', { hour12: false });
        const student = state.students.find(s => s.id === item.student_id);
        const title = student ? student.name : '（已删除学生）';
        return `
          <div class="history-card" onclick="summary.showHistoryItem('${item.id}')">
            <div class="history-card-head">
              <span class="history-card-title">${title}</span>
              <span class="history-card-date">${dateStr}</span>
            </div>
            <div class="history-card-preview">${this._truncate(item.content, 80)}</div>
          </div>`;
      }).join('');
    } catch (error) {
      container.innerHTML = '<p class="history-empty">加载历史失败</p>';
    }
  },

  _truncate(text, n) {
    if (!text) return '';
    const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe.length > n ? safe.slice(0, n) + '...' : safe;
  },

  async showHistoryItem(id) {
    const { items } = await summaryHistoryAPI.list(this.currentTab, null);
    const item = (items || []).find(x => x.id === id);
    if (!item) return;
    const dt = new Date(item.created_at);
    const dateStr = dt.toLocaleString('zh-CN', { hour12: false });
    const teacherNote = item.teacher_note ? `<div class="ai-summary-meta">📝 老师反馈：${item.teacher_note}</div>` : '';
    const safe = item.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    modal.show(`${dateStr}`, `
      <div class="ai-summary-box">
        ${teacherNote}
        <pre class="ai-summary-text">${safe}</pre>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">关闭</button>
          <button class="btn btn-primary" onclick="summary.copyHistoryContent(\`${item.content.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/\$/g, '\\$')}\`)">📋 复制</button>
        </div>
      </div>
    `);
  },

  copyHistoryContent(text) {
    copyToClipboard(text);
    toast.success('已复制');
  },

  showClearDialog() {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    modal.show('🗑 清理历史记录', `
      <div class="modal-form">
        <p style="margin-bottom:12px;color:var(--gray-500);font-size:13px;">删除早于指定日期的历史记录。日期早于 1 个月的记录已自动从列表隐藏，但仍保存在数据库中，可用此功能清理。</p>
        <div class="form-item">
          <label>删除早于</label>
          <input type="date" id="clearBeforeDate" value="${thirtyDaysAgo}" min="${thirtyDaysAgo}" max="${today}">
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="summary.confirmClear()">确认删除</button>
        </div>
      </div>
    `);
  },

  async confirmClear() {
    const date = document.getElementById('clearBeforeDate').value;
    if (!date) { toast.error('请选择日期'); return; }
    if (!confirm(`确定删除 ${date} 之前的所有历史记录吗？此操作不可撤销。`)) return;
    loading.show('清理中...');
    try {
      const { deleted } = await summaryHistoryAPI.clearBefore(date + 'T00:00:00Z');
      toast.success(`已删除 ${deleted} 条记录`);
      modal.close();
      // 刷新当前 Tab 历史
      const selId = { homework: 'homeworkStudent', daily: 'dailyStudent', weekly: 'weeklyStudent' }[this.currentTab];
      const sel = document.getElementById(selId);
      this.loadHistory(this.currentTab, sel && sel.value ? sel.value : null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  // === 板块一：作业情况（按学生单日统计） ===
  async generateHomework() {
    const studentId = document.getElementById('homeworkStudent').value;
    if (!studentId) { toast.error('请先选择学生'); return; }
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    loading.show('生成中...');
    try {
      const token = await authAPI.getAccessToken();
      if (!token) { toast.error('登录已失效'); return; }

      const stats = await dailyStatsAPI.fetch(state.currentDate, studentId);
      const payload = {
        mode: 'homework',
        date: state.currentDate,
        student_name: student.name,
        grade: student.grade,
        subjects: stats.subjects,
        students: stats.students
      };
      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.summary) throw new Error(data.error || '生成失败');

      const safe = data.summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.getElementById('summaryContent').innerHTML = `
        <div class="ai-summary-box">
          <div class="ai-summary-meta">${student.name} · ${formatDate(state.currentDate)}</div>
          <pre class="ai-summary-text">${safe}</pre>
        </div>`;
      document.getElementById('summaryContent').dataset.copyText = data.summary;
      document.getElementById('summaryActions').style.display = 'flex';

      // 写入历史
      await summaryHistoryAPI.save({
        kind: 'homework',
        student_id: studentId,
        period_start: state.currentDate,
        period_end: state.currentDate,
        content: data.summary,
        payload
      });
      await this.loadHistory('homework', studentId);
      toast.success('报告已生成');
    } catch (error) {
      console.error('作业情况生成失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  regenerate() { return this.generateHomework(); },

  copySummary() {
    const copyText = document.getElementById('summaryContent').dataset.copyText;
    if (copyText) copyToClipboard(copyText);
  },

  // === 板块二：日常总结（按学生 + 老师备注） ===
  async generateDaily() {
    const studentId = document.getElementById('dailyStudent').value;
    if (!studentId) { toast.error('请先选择学生'); return; }
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;
    const teacherNote = document.getElementById('dailyTeacherNote').value.trim();
    if (!teacherNote) { toast.error('请填写老师反馈'); return; }

    loading.show('AI 生成日常总结...');
    try {
      const token = await authAPI.getAccessToken();
      if (!token) { toast.error('登录已失效'); return; }

      const stats = await dailyStatsAPI.fetch(state.currentDate, studentId);
      const payload = {
        mode: 'daily',
        date: state.currentDate,
        student_name: student.name,
        grade: student.grade,
        subjects: stats.subjects,
        teacher_note: teacherNote
      };
      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.summary) throw new Error(data.error || '生成失败');

      this.dailyAi = data.summary;
      const safe = data.summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.getElementById('dailyContent').innerHTML = `
        <div class="ai-summary-box">
          <div class="ai-summary-meta">${student.name} · ${formatDate(state.currentDate)}</div>
          <pre class="ai-summary-text">${safe}</pre>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="summary.copyDaily()">📋 复制发家长</button>
          </div>
        </div>`;

      await summaryHistoryAPI.save({
        kind: 'daily',
        student_id: studentId,
        period_start: state.currentDate,
        period_end: state.currentDate,
        teacher_note: teacherNote,
        content: data.summary,
        payload
      });
      await this.loadHistory('daily', studentId);
      toast.success('日常总结已生成');
    } catch (error) {
      console.error('日常总结失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  copyDaily() {
    if (this.dailyAi) { copyToClipboard(this.dailyAi); toast.success('已复制'); }
  },

  // === 板块三：周总结（按学生） ===
  async generateWeekly() {
    const studentId = document.getElementById('weeklyStudent').value;
    if (!studentId) { toast.error('请先选择学生'); return; }
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    loading.show('AI 生成周总结...');
    try {
      const token = await authAPI.getAccessToken();
      if (!token) { toast.error('登录已失效'); return; }

      const [weekStart, weekEnd] = currentWeekRange();
      const [weekStats, assessRes] = await Promise.all([
        weekStatsAPI.fetch(studentId, weekStart, weekEnd),
        assessmentsAPI.listByStudent(studentId)
      ]);

      const payload = {
        mode: 'weekly',
        student_name: student.name,
        grade: student.grade,
        enrolled_at: student.enrolled_at,
        week_start: weekStart,
        week_end: weekEnd,
        week_stats: weekStats,
        assessments: assessRes.assessments.map(a => ({
          subject: a.subject?.name || '已删除科目',
          type: ASSESS_TYPES[a.assess_type] || a.assess_type,
          date: a.assess_date,
          level: a.level,
          weak_points: a.weak_points
        }))
      };
      const resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.summary) throw new Error(data.error || '生成失败');

      this.weeklyAi = data.summary;
      const safe = data.summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      document.getElementById('weeklyContent').innerHTML = `
        <div class="ai-summary-box">
          <div class="ai-summary-meta">${student.name} · ${weekStart} 至 ${weekEnd}</div>
          <pre class="ai-summary-text">${safe}</pre>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="summary.copyWeekly()">📋 复制发给家长</button>
          </div>
        </div>`;

      await summaryHistoryAPI.save({
        kind: 'weekly',
        student_id: studentId,
        period_start: weekStart,
        period_end: weekEnd,
        content: data.summary,
        payload
      });
      await this.loadHistory('weekly', studentId);
      toast.success('周总结已生成');
    } catch (error) {
      console.error('周总结失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  copyWeekly() {
    if (this.weeklyAi) { copyToClipboard(this.weeklyAi); toast.success('已复制'); }
  }
};

// 本周一到本周日的日期区间（周总结用）
function currentWeekRange() {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

// ========== 学生学情档案 ==========
const LEVEL_LABELS = ['', '入门', '较弱', '中等', '良好', '优秀'];
const ASSESS_TYPES = {
  enroll: '入学基线',
  daily: '日常',
  midterm: '期中',
  final: '期末'
};

// 把评估记录按科目归组，算出「入学基线 vs 最新」
function buildSubjectComparison(subjects, assessments) {
  const bySubject = new Map();
  assessments.forEach(item => {
    if (!bySubject.has(item.subject_id)) bySubject.set(item.subject_id, []);
    bySubject.get(item.subject_id).push(item);
  });

  return subjects.map(subject => {
    const history = bySubject.get(subject.id) || [];
    const baseline = history.find(a => a.assess_type === 'enroll') || history[0] || null;
    const latest = history[history.length - 1] || null;
    const delta = baseline && latest ? latest.level - baseline.level : null;

    return {
      subject,
      history,
      baseline,
      latest,
      delta,
      assessed: history.length > 0,
      // 薄弱：最新水平 <= 2 级
      isWeak: !!latest && latest.level <= 2
    };
  });
}

function renderLevelDots(level) {
  if (!level) return '<span class="level-none">未评估</span>';
  const dots = Array.from({ length: 5 }, (_, i) =>
    `<span class="dot ${i < level ? 'on' : ''}"></span>`).join('');
  return `<span class="level-dots">${dots}</span><span class="level-text">${LEVEL_LABELS[level]}</span>`;
}

function renderDelta(delta) {
  if (delta === null || delta === undefined) return '';
  if (delta > 0) return `<span class="delta up">↑ +${delta}</span>`;
  if (delta < 0) return `<span class="delta down">↓ ${delta}</span>`;
  return '<span class="delta flat">— 持平</span>';
}

const profile = {
  open(studentId) {
    state.currentStudentId = studentId;
    router.navigate('profile');
  },

  async load() {
    if (!state.currentStudentId) return null;
    const student = state.students.find(s => s.id === state.currentStudentId);
    if (!student) return null;

    const { assessments } = await assessmentsAPI.listByStudent(student.id);
    return { student, comparison: buildSubjectComparison(state.subjects, assessments) };
  },

  async render() {
    const container = document.getElementById('profileContent');
    const data = await this.load();

    if (!data) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">学生不存在，请返回重试</p></div>';
      return;
    }

    const { student, comparison } = data;
    const weakList = comparison.filter(c => c.isWeak);

    let html = `
      <div class="profile-card">
        <div class="profile-name">${student.name}</div>
        <div class="profile-meta">
          <span>${student.grade || '未填年级'}</span>
          <span>入学：${student.enrolled_at || '未填'}</span>
        </div>
        ${weakList.length ? `<div class="profile-weak">⚠️ 薄弱科目：${weakList.map(c => c.subject.name).join('、')}</div>` : ''}
      </div>

      <div class="profile-section-head">
        <h3>各科水平对比</h3>
        <div class="profile-actions">
          <button class="btn btn-primary btn-sm" onclick="profile.showAddModal()">＋ 记录学情</button>
        </div>
      </div>
      <div class="assess-table">
        <div class="assess-row assess-row-head">
          <span>科目</span><span>入学</span><span>现在</span><span>变化</span>
        </div>
    `;

    comparison.forEach(row => {
      html += `
        <div class="assess-row">
          <span class="assess-subject">${row.subject.icon || ''} ${row.subject.name}${row.isWeak ? ' <em class="weak-tag">薄弱</em>' : ''}</span>
          <span>${renderLevelDots(row.baseline?.level)}</span>
          <span>${renderLevelDots(row.latest?.level)}</span>
          <span>${renderDelta(row.delta)}</span>
        </div>
      `;
    });

    html += '</div>';

    // 历次记录（按时间倒序）
    const allHistory = comparison.flatMap(c => c.history).sort((a, b) => b.assess_date.localeCompare(a.assess_date));
    html += `<div class="profile-section-head"><h3>评估记录（${allHistory.length}）</h3></div>`;

    if (allHistory.length === 0) {
      html += '<div class="empty-state"><p class="empty-state-text">还没有学情记录，点击上方「记录学情」录入入学基线</p></div>';
    } else {
      html += '<div class="history-list">';
      allHistory.forEach(item => {
        html += `
          <div class="history-item">
            <div class="history-main">
              <div class="history-title">
                ${item.subject?.icon || ''} ${item.subject?.name || '已删除科目'}
                <em class="type-tag ${item.assess_type}">${ASSESS_TYPES[item.assess_type] || item.assess_type}</em>
              </div>
              <div class="history-sub">${item.assess_date} · ${LEVEL_LABELS[item.level]}</div>
              ${item.weak_points ? `<div class="history-weak">薄弱点：${item.weak_points}</div>` : ''}
              ${item.note ? `<div class="history-note">${item.note}</div>` : ''}
            </div>
            <button class="list-item-btn" onclick="profile.remove('${item.id}')">🗑️</button>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  showAddModal() {
    const subjectOptions = state.subjects
      .map(s => `<option value="${s.id}">${s.icon || ''} ${s.name}</option>`).join('');
    const levelOptions = LEVEL_LABELS.slice(1)
      .map((label, i) => `<option value="${i + 1}">${i + 1} 级 · ${label}</option>`).join('');

    modal.show('记录学情', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目 *</label>
          <select id="assessSubject">${subjectOptions}</select>
        </div>
        <div class="form-item">
          <label>评估类型 *</label>
          <select id="assessType">
            <option value="enroll">入学基线</option>
            <option value="daily" selected>日常</option>
            <option value="midterm">期中</option>
            <option value="final">期末</option>
          </select>
        </div>
        <div class="form-item">
          <label>评估日期 *</label>
          <input type="date" id="assessDate" value="${formatFullDate(new Date().toISOString())}">
        </div>
        <div class="form-item">
          <label>水平等级 *</label>
          <select id="assessLevel">${levelOptions}</select>
        </div>
        <div class="form-item">
          <label>薄弱点</label>
          <textarea id="assessWeak" rows="2" placeholder="如：分数应用题会做，单位换算常错"></textarea>
        </div>
        <div class="form-item">
          <label>备注</label>
          <textarea id="assessNote" rows="2" placeholder="选填"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="profile.save()">保存</button>
        </div>
      </div>
    `);
  },

  async save() {
    const payload = {
      student_id: state.currentStudentId,
      subject_id: document.getElementById('assessSubject').value,
      assess_type: document.getElementById('assessType').value,
      assess_date: document.getElementById('assessDate').value,
      level: Number(document.getElementById('assessLevel').value),
      weak_points: document.getElementById('assessWeak').value.trim() || null,
      note: document.getElementById('assessNote').value.trim() || null
    };

    if (!payload.subject_id || !payload.assess_date) {
      toast.error('请选择科目和日期');
      return;
    }

    loading.show('保存中...');
    try {
      await assessmentsAPI.create(payload);
      modal.close();
      toast.success('已记录');
      await this.render();
    } catch (error) {
      console.error('保存学情失败:', error);
      // 唯一索引冲突：同科目同日同类型已存在
      toast.error(error.code === '23505' ? '该科目当天已有同类型记录' : error.message);
    } finally {
      loading.hide();
    }
  },

  async remove(id) {
    if (!confirm('确定删除这条学情记录吗？')) return;
    loading.show('删除中...');
    try {
      await assessmentsAPI.delete(id);
      await this.render();
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  };

async function initProfilePage() {
  await profile.render();
}

// 应用启动
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  initApp();
});

// 暴露给全局
window.router = router;
window.modal = modal;
window.toast = toast;
window.students = students;
window.profile = profile;
window.plans = plans;
window.subjects = subjects;
window.correct = correct;
window.summary = summary;
