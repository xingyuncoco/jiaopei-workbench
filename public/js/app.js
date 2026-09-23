/**
 * 教培工作台 - 主应用逻辑
 * 全局 API（从 window 读取）
 */

const { studentsAPI, subjectsAPI, plansAPI, reportsAPI, summariesAPI, assessmentsAPI, weekStatsAPI, dailyNotesAPI, summaryHistoryAPI } = window;

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
  pages: ['home', 'students', 'plans', 'subjects', 'correct', 'summary', 'profile', 'subjectProfile'],

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
    if (page === 'subjectProfile') initSubjectProfilePage();

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
          <label>入学时间</label>
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
          <label>入学时间</label>
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
    // 空字符串会被 Postgres 判为非法日期，必须转成 null
    const enrolled_at = document.getElementById('studentEnrolledAt').value || null;

    if (!name) {
      toast.error('请输入学生姓名');
      return;
    }

    loading.show('保存中...');

    try {
      if (id) {
        await studentsAPI.update(id, { name, grade, enrolled_at });
        toast.success('修改成功');
      } else {
        await studentsAPI.create({ name, grade, enrolled_at });
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
  correct.reset();
}

const correct = {
  // 本次批改的状态
  photos: [],          // [{ file, dataUrl, pageNumber, aiResult|null }]
  results: [],         // AI 返回的解析结果，与 photos 一一对应

  reset() {
    this.photos = [];
    this.results = [];
    const fileInput = document.getElementById('correctImagesInput');
    if (fileInput) fileInput.value = '';
    this._renderThumbs();
    this._refreshButtons();
    const result = document.getElementById('correctResult');
    if (result) result.style.display = 'none';
    const saveBtn = document.getElementById('correctSaveBtn');
    if (saveBtn) saveBtn.style.display = 'none';
  },

  onContextChange() {
    // 切换学生/科目时清掉已选照片
    this.reset();
  },

  triggerAddPhotos() {
    document.getElementById('correctImagesInput').click();
  },

  handleImagesSelect(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    // 限制：单张 ≤ 10MB，已选 ≤ 5 张
    const remaining = 5 - this.photos.length;
    if (remaining <= 0) {
      toast.error('本次批改最多 5 张照片');
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(`只取前 ${remaining} 张，请分多次批改`);
    }
    accepted.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 超过 10MB，已跳过`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photos.push({
          file,
          dataUrl: e.target.result,
          pageNumber: this.photos.length + 1,
          aiResult: null
        });
        this._renderThumbs();
        this._refreshButtons();
      };
      reader.readAsDataURL(file);
    });
  },

  _renderThumbs() {
    const wrap = document.getElementById('correctThumbnails');
    if (!wrap) return;
    if (this.photos.length === 0) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = this.photos.map((p, i) => `
      <div class="correct-thumb ${p.aiResult ? 'is-graded' : ''}">
        <img src="${p.dataUrl}">
        <span class="correct-thumb-page">第 ${p.pageNumber} 页${p.aiResult ? ' · ✅' : ''}</span>
        <button class="correct-thumb-del" onclick="correct.removePhoto(${i})">×</button>
      </div>
    `).join('');
  },

  removePhoto(i) {
    this.photos.splice(i, 1);
    this.results.splice(i, 1);
    // 重排页码
    this.photos.forEach((p, idx) => p.pageNumber = idx + 1);
    this._renderThumbs();
    this._refreshButtons();
  },

  _refreshButtons() {
    document.getElementById('correctPhotoCount').textContent = `已选 ${this.photos.length} 张`;
    const studentId = document.getElementById('correctStudentSelect').value;
    const subjectId = document.getElementById('correctSubjectSelect').value;
    document.getElementById('correctBtn').disabled =
      !(this.photos.length > 0 && studentId && subjectId);
  },

  async startCorrect() {
    const studentId = document.getElementById('correctStudentSelect').value;
    const subjectId = document.getElementById('correctSubjectSelect').value;
    if (!studentId || !subjectId) { toast.error('请选择学生和科目'); return; }
    if (this.photos.length === 0) { toast.error('请先添加照片'); return; }

    loading.show('AI 批改中...');
    try {
      const token = await authAPI.getAccessToken();
      if (!token) { toast.error('登录已失效'); return; }
      const subject = state.subjects.find(s => s.id === subjectId);
      const subjectName = subject?.name || '';

      this.results = [];
      // 逐张调 AI
      for (let i = 0; i < this.photos.length; i++) {
        const photo = this.photos[i];
        const resp = await fetch('/api/grade-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            imageBase64: photo.dataUrl,
            subject: subjectName,
            pageNumber: photo.pageNumber
          })
        });
        const data = await resp.json();
        if (!resp.ok || !data.result) {
          throw new Error(data.error || `第 ${photo.pageNumber} 张批改失败`);
        }
        this.results.push(data.result);
        photo.aiResult = data.result;
        this._renderThumbs();
      }

      this._renderResult();
      document.getElementById('correctSaveBtn').style.display = 'block';
      toast.success('批改完成');
    } catch (error) {
      console.error('批改失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  // 聚合多张结果给老师看
  _renderResult() {
    const container = document.getElementById('correctResult');
    container.style.display = 'block';

    let totalQ = 0, correct = 0, wrong = 0, empty = 0;
    this.results.forEach(r => {
      totalQ += r.total_count || r.total || 0;
      correct += r.correct_count || r.correct || 0;
      wrong  += r.wrong_count || r.wrong || 0;
      empty  += r.empty_count || r.empty || 0;
    });
    const accuracy = totalQ > 0 ? Math.round(correct / totalQ * 100) : 0;

    const weakSet = new Set();
    this.results.forEach(r => (r.weak_points || []).forEach(w => weakSet.add(w)));
    const suggestions = this.results.map(r => r.suggestion || r.advice).filter(Boolean);

    container.innerHTML = `
      <div class="grade-summary">
        <div class="grade-stat"><div class="grade-stat-val">${totalQ}</div><div class="grade-stat-lbl">总题数</div></div>
        <div class="grade-stat"><div class="grade-stat-val">${correct}</div><div class="grade-stat-lbl">做对</div></div>
        <div class="grade-stat"><div class="grade-stat-val">${wrong}</div><div class="grade-stat-lbl">做错</div></div>
        <div class="grade-stat"><div class="grade-stat-val">${empty}</div><div class="grade-stat-lbl">未答</div></div>
        <div class="grade-stat grade-stat-acc"><div class="grade-stat-val">${accuracy}%</div><div class="grade-stat-lbl">准确率</div></div>
      </div>
      ${[...weakSet].length ? `<div class="grade-weak"><h4>📊 本次薄弱点</h4><ul>${[...weakSet].map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
      ${suggestions.length ? `<div class="grade-teacher"><h4>🎓 建议</h4><ul>${suggestions.map(a => `<li>${a}</li>`).join('')}</ul></div>` : ''}
    `;
  },

  // 保存为多条 homework_reports（每张照片一条，共享同一 batch_id）
  async saveAll() {
    const studentId = document.getElementById('correctStudentSelect').value;
    const subjectId = document.getElementById('correctSubjectSelect').value;
    if (!studentId || !subjectId) { toast.error('请选择学生和科目'); return; }
    if (!this.results.length) { toast.error('请先批改'); return; }

    loading.show('保存中...');
    try {
      const userResult = await supabaseClient.auth.getUser();
      const userId = userResult.data?.user?.id;

      // 找当天的 homework_plans 中匹配学生+科目+日期的那一条，作为关联
      let planId = null;
      const plan = state.plans.find(p =>
        p.student_id === studentId &&
        p.subject_id === subjectId &&
        p.plan_date === state.currentDate
      );
      if (plan) planId = plan.id;

      // 同一批次多张照片共享一个 batch_id
      const batchId = crypto.randomUUID();

      // 用于汇总评估记录
      let totalCorrect = 0, totalWrong = 0, totalEmpty = 0, totalCount = 0;
      const allWeakPoints = [];

      // 每张照片单独存一条 homework_reports（保留每页的原始结果）
      for (let i = 0; i < this.photos.length; i++) {
        const photo = this.photos[i];
        const r = this.results[i] || {};
        const tc = r.total_count || r.total || 0;
        const cc = r.correct_count || r.correct || 0;
        const wc = r.wrong_count || r.wrong || 0;
        const ec = r.empty_count || r.empty || r.blank || 0;
        const acc = tc > 0 ? Math.round(cc / tc * 100) : 0;

        // 累计
        totalCount += tc;
        totalCorrect += cc;
        totalWrong += wc;
        totalEmpty += ec;

        // 收集薄弱点
        if (r.weak_points) {
          const wps = Array.isArray(r.weak_points) ? r.weak_points : [r.weak_points];
          wps.forEach(wp => wp && allWeakPoints.push(wp));
        }

        await reportsAPI.create({
          student_id: studentId,
          subject_id: subjectId,
          plan_date: state.currentDate,
          plan_id: planId,
          accuracy: acc,
          total_count: tc,
          correct_count: cc,
          wrong_count: wc,
          empty_count: ec,
          weak_points: r.weak_points || [],
          suggestion: r.suggestion || r.advice || null,
          batch_id: batchId,
          user_id: userId
        });
      }

      // 自动标记规划为已完成
      if (planId) {
        try { await plansAPI.toggleComplete(planId, true); } catch (_) {}
      }

      // 自动创建评估记录（来自拍照批改）
      try {
        const totalAccuracy = totalCount > 0 ? Math.round(totalCorrect / totalCount * 100) : 0;
        // 根据准确率计算等级
        let level = 1;
        if (totalAccuracy >= 95) level = 5;      // S
        else if (totalAccuracy >= 90) level = 4;  // A
        else if (totalAccuracy >= 80) level = 3;  // B
        else if (totalAccuracy >= 70) level = 2;  // C
        else if (totalAccuracy >= 60) level = 1;  // D

        const weakPointsStr = [...new Set(allWeakPoints)].join('、');

        await assessmentsAPI.create({
          student_id: studentId,
          subject_id: subjectId,
          assess_type: 'daily',
          assess_date: state.currentDate,
          level,
          weak_points: weakPointsStr || null,
          note: `拍照批改自动生成（准确率${totalAccuracy}%）`
        });
      } catch (e) {
        console.warn('自动创建评估记录失败:', e);
      }

      toast.success(`已保存 ${this.photos.length} 张批改`);
      document.getElementById('correctSaveBtn').style.display = 'none';
      // 刷新今日待办等依赖数据
      if (typeof state.loadPlans === 'function') await state.loadPlans();
      if (typeof updateQuickList === 'function') updateQuickList();
    } catch (error) {
      console.error('保存失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
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
    if (this.currentTab === 'homework') this.loadHomeworkDetail();
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

  // === 板块一：作业情况（按学生 + 当天批改明细） ===
  async generateHomework() {
    const studentId = document.getElementById('homeworkStudent').value;
    if (!studentId) { toast.error('请先选择学生'); return; }
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    loading.show('加载中...');
    try {
      const subjectMap = Object.fromEntries(state.subjects.map(s => [s.id, s]));
      const { reports } = await reportsAPI.list({ date: state.currentDate, student_id: studentId });

      if (!reports || reports.length === 0) {
        document.getElementById('summaryContent').innerHTML = '<p class="empty-tip">今日暂无批改记录</p>';
        document.getElementById('summaryActions').style.display = 'none';
        return;
      }

      const mergedSubjects = this._mergeReportsBySubject(reports, subjectMap);

      // 直接拼接文本，不需要 AI 生成
      let summaryText = `【${student.name} 今日作业情况】${state.currentDate}\n\n`;
      mergedSubjects.forEach(sub => {
        summaryText += `${sub.icon || '📝'} ${sub.subject}：共${sub.total}题，对${sub.correct}，错${sub.wrong}，空${sub.blank}，准确率${sub.accuracy}%\n`;
        if (sub.weak_points && sub.weak_points.length > 0) {
          summaryText += `  薄弱点：${sub.weak_points.join('、')}\n`;
        }
        if (sub.advice) {
          summaryText += `  建议：${sub.advice}\n`;
        }
        summaryText += '\n';
      });

      // 生成可复制文本（纯文本格式）
      let copyText = `【${student.name} 今日作业情况】${state.currentDate}\n`;
      mergedSubjects.forEach(sub => {
        copyText += `${sub.icon || '📝'} ${sub.subject}：共${sub.total}题，对${sub.correct}，错${sub.wrong}，空${sub.blank}，准确率${sub.accuracy}%`;
        if (sub.weak_points && sub.weak_points.length > 0) {
          copyText += `，薄弱点：${sub.weak_points.join('、')}`;
        }
        if (sub.advice) {
          copyText += `，建议：${sub.advice}`;
        }
        copyText += '\n';
      });

      document.getElementById('summaryContent').innerHTML = `
        <div class="ai-summary-box">
          <div class="ai-summary-meta">${student.name} · ${formatDate(state.currentDate)}</div>
          <pre class="ai-summary-text">${summaryText}</pre>
        </div>`;
      document.getElementById('summaryContent').dataset.copyText = copyText;
      document.getElementById('summaryActions').style.display = 'flex';

      // 写入历史
      await summaryHistoryAPI.save({
        kind: 'homework',
        student_id: studentId,
        period_start: state.currentDate,
        period_end: state.currentDate,
        content: copyText
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

  // 加载当天该学生所有批改记录并按科目合并展示
  async loadHomeworkDetail() {
    const studentId = document.getElementById('homeworkStudent').value;
    const btn = document.getElementById('homeworkGenerateBtn');
    const detailEl = document.getElementById('homeworkDetail');
    btn.disabled = !studentId;

    // 切学生时清掉上一份报告
    document.getElementById('summaryContent').innerHTML = '';
    document.getElementById('summaryActions').style.display = 'none';

    if (!studentId) {
      detailEl.innerHTML = '<p class="hint">请选择学生查看当天作业情况</p>';
      this.loadHistory('homework', null);
      return;
    }

    loading.show('加载作业情况...');
    try {
      const { reports } = await reportsAPI.list({ date: state.currentDate, student_id: studentId });
      const student = state.students.find(s => s.id === studentId);
      const subjectMap = Object.fromEntries(state.subjects.map(s => [s.id, s]));

      if (!reports || reports.length === 0) {
        detailEl.innerHTML = `<p class="hint">${student?.name || ''} 在 ${formatDate(state.currentDate)} 还没有批改记录</p>`;
      } else {
        const merged = this._mergeReportsBySubject(reports, subjectMap);
        detailEl.innerHTML = this._renderHomeworkTable(student, merged);
      }

      this.loadHistory('homework', studentId);
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  // 同一学生同一科目多次批改 → 合并平均
  _mergeReportsBySubject(reports, subjectMap) {
    const map = {};
    reports.forEach(r => {
      const subjName = r.subject?.name || subjectMap[r.subject_id]?.name || '未知道目';
      if (!map[subjName]) {
        map[subjName] = {
          subject: subjName,
          icon: r.subject?.icon || subjectMap[r.subject_id]?.icon || '',
          total: 0, correct: 0, wrong: 0, empty: 0,
          weakSet: new Set(), suggestions: [], count: 0
        };
      }
      const m = map[subjName];
      m.total   += r.total_count || r.total_questions || 0;
      m.correct += r.correct_count || 0;
      m.wrong   += r.wrong_count || 0;
      m.empty   += r.empty_count || r.blank_count || 0;
      m.count   += 1;
      // weak_points 可能是数组或字符串
      const weakPoints = r.weak_points;
      if (Array.isArray(weakPoints)) {
        weakPoints.forEach(w => m.weakSet.add(w));
      } else if (typeof weakPoints === 'string' && weakPoints) {
        weakPoints.split(/[；;]/).map(s => s.trim()).filter(Boolean).forEach(w => m.weakSet.add(w));
      }
      if (r.suggestion || r.overall_advice || r.advice) {
        m.suggestions.push(r.suggestion || r.overall_advice || r.advice);
      }
    });
    return Object.values(map).map(m => ({
      subject: m.subject,
      icon: m.icon,
      total: m.total,
      correct: m.correct,
      wrong: m.wrong,
      blank: m.empty,
      accuracy: m.total > 0 ? Math.round(m.correct / m.total * 100) : 0,
      weak_points: [...m.weakSet],
      advice: m.suggestions.join('；'),
      count: m.count
    }));
  },

  _renderHomeworkTable(student, items) {
    const rows = items.map(it => `
      <tr>
        <td>${it.icon ? it.icon + ' ' : ''}${it.subject}${it.count > 1 ? ` <span class="badge">×${it.count}</span>` : ''}</td>
        <td>${it.total}</td>
        <td class="grade-correct">${it.correct}</td>
        <td class="grade-wrong">${it.wrong}</td>
        <td class="grade-blank">${it.blank}</td>
        <td><b>${it.accuracy}%</b></td>
        <td>${it.weak_points.length ? it.weak_points.join('；') : '—'}</td>
        <td>${it.advice || '—'}</td>
      </tr>`).join('');
    return `
      <div class="homework-table-wrap">
        <table class="homework-table">
          <thead>
            <tr>
              <th>科目</th><th>总题</th><th>对</th><th>错</th><th>空</th><th>准确率</th><th>薄弱点</th><th>老师建议</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
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
      // 找到该学生的数据
      const studentStats = stats.students && stats.students[0];
      
      const payload = {
        mode: 'daily',
        date: state.currentDate,
        student_name: student.name,
        grade: student.grade,
        // 传入学生的批改报告详情，让 AI 分析
        student_reports: studentStats?.reports || [],
        weak_points: studentStats?.weak_points || [],
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
        content: data.summary
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
        // 匹配后端字段名
        week_daily: weekStats.daily,
        week_stats_by_subject: weekStats.bySubject,
        week_weak_points: weekStats.weekWeakPoints,
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

    const { student } = data;
    const studentId = student.id;

    // 获取本周数据（自然周：周一到周日）
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 把周日从0转为7
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // 获取本周批改报告
    const { data: weekReports } = await supabaseClient
      .from('homework_reports')
      .select('*')
      .eq('student_id', studentId)
      .gte('plan_date', weekStartStr)
      .lte('plan_date', weekEndStr)
      .order('plan_date', { ascending: false });

    // 获取所有批改报告（用于趋势计算）
    const { data: allReports } = await supabaseClient
      .from('homework_reports')
      .select('subject_id, accuracy, plan_date, weak_points')
      .eq('student_id', studentId)
      .order('plan_date', { ascending: false });

    // 获取最近一次生成的综合分析报告
    const { data: savedAnalysis } = await supabaseClient
      .from('summary_history')
      .select('*')
      .eq('student_id', studentId)
      .eq('kind', 'profile_analysis')
      .order('created_at', { ascending: false })
      .limit(1);

    // 按科目分组计算准确率和趋势
    const subjectStats = {};
    state.subjects.forEach(s => {
      const subjectReports = (allReports || []).filter(r => r.subject_id === s.id);
      if (subjectReports.length > 0) {
        const accuracies = subjectReports.map(r => Number(r.accuracy)).filter(a => a > 0);
        const avgAccuracy = accuracies.length > 0
          ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
          : 0;
        // 计算趋势（最新5次 vs 前5次）
        const recent = accuracies.slice(0, 5);
        const older = accuracies.slice(5, 10);
        const recentAvg = recent.length > 0 ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 0;
        const olderAvg = older.length > 0 ? Math.round(older.reduce((a, b) => a + b, 0) / older.length) : recentAvg;
        const trend = recentAvg - olderAvg;

        subjectStats[s.id] = {
          subject: s,
          reportCount: subjectReports.length,
          avgAccuracy,
          trend,
          recentAccuracy: recentAvg
        };
      }
    });

    // 本周各科汇总
    const weekBySubject = {};
    (weekReports || []).forEach(r => {
      const s = state.subjects.find(sub => sub.id === r.subject_id);
      if (!s) return;
      if (!weekBySubject[s.id]) {
        weekBySubject[s.id] = { name: s.name, icon: s.icon, count: 0, accuracies: [], weakPoints: new Set() };
      }
      weekBySubject[s.id].count++;
      if (r.accuracy) weekBySubject[s.id].accuracies.push(Number(r.accuracy));
      if (r.weak_points) {
        const wps = Array.isArray(r.weak_points) ? r.weak_points : String(r.weak_points).split(/[；;]/).filter(Boolean);
        wps.forEach(wp => weekBySubject[s.id].weakPoints.add(wp));
      }
    });

    // 转换为数组
    const weekSummary = Object.values(weekBySubject).map(item => ({
      ...item,
      avgAccuracy: item.accuracies.length > 0
        ? Math.round(item.accuracies.reduce((a, b) => a + b, 0) / item.accuracies.length)
        : 0,
      weakPoints: [...item.weakPoints]
    }));

    // 综合分析卡片
    let analysisHtml = '';
    if (savedAnalysis && savedAnalysis.length > 0) {
      // 显示已保存的分析
      const analysis = savedAnalysis[0];
      analysisHtml = `
        <div class="profile-analysis-title">本周整体评估</div>
        <div class="profile-analysis-content">${analysis.content}</div>
        <div class="profile-analysis-meta">
          基于 ${weekReports?.length || 0} 次批改 · ${weekStartStr} ~ ${weekEndStr}
          <button class="btn-regenerate" onclick="profile.regenerateAnalysis()">重新生成</button>
        </div>
      `;
    } else if ((weekReports || []).length === 0) {
      analysisHtml = `
        <div class="profile-analysis-title">本周整体评估</div>
        <div class="profile-analysis-content">暂无本周批改数据，请先进行拍照批改。</div>
        <div class="profile-analysis-meta">${weekStartStr} ~ ${weekEndStr}</div>
      `;
    } else {
      // 有数据但未生成分析
      analysisHtml = `
        <div class="profile-analysis-title">本周整体评估</div>
        <div class="profile-analysis-content">点击下方按钮，AI 将基于本周 ${weekReports.length} 次批改数据生成综合分析。</div>
        <button class="btn-generate-analysis" onclick="profile.generateAnalysis()">🤖 生成综合分析</button>
      `;
    }

    let html = `
      <!-- 基本信息卡片 -->
      <div class="profile-card">
        <div class="profile-name">${student.name}</div>
        <div class="profile-meta">
          <span>${student.grade || '未填年级'}</span>
          <span>入学：${student.enrolled_at || '未填'}</span>
        </div>
      </div>

      <!-- 综合分析 -->
      <div class="profile-section-head">
        <h3>📊 综合分析</h3>
        <span class="week-range">${weekStartStr} ~ ${weekEndStr}</span>
      </div>
      <div class="profile-analysis-card" id="analysisCard">
        ${analysisHtml}
      </div>

      <!-- 本周各科汇总 -->
      ${weekSummary.length > 0 ? `
        <div class="profile-section-head">
          <h3>📋 本周各科汇总</h3>
        </div>
        <div class="week-summary-card">
          ${weekSummary.map(item => `
            <div class="week-summary-item">
              <div class="week-summary-subject">${item.icon || '📝'} ${item.name}</div>
              <div class="week-summary-stats">
                <span>批改 ${item.count} 次</span>
                <span>平均 ${item.avgAccuracy}%</span>
              </div>
              ${item.weakPoints.length > 0 ? `
                <div class="week-summary-weak">薄弱点：${item.weakPoints.join('、')}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- 科目列表 -->
      <div class="profile-section-head">
        <h3>📚 科目详情（点击查看/编辑）</h3>
      </div>
    `;

    // 获取所有科目的基本情况（入学基线）
    const { data: enrollAssessments } = await supabaseClient
      .from('assessments')
      .select('*')
      .eq('student_id', studentId)
      .eq('assess_type', 'enroll');

    // 按科目分组
    const enrollBySubject = {};
    (enrollAssessments || []).forEach(a => {
      enrollBySubject[a.subject_id] = a;
    });

    // 显示所有科目（包括没有数据的）
    state.subjects.forEach(s => {
      const stats = subjectStats[s.id];
      const enroll = enrollBySubject[s.id];
      const avgAccuracy = stats ? stats.avgAccuracy : 0;
      const trend = stats ? stats.trend : 0;
      const reportCount = stats ? stats.reportCount : 0;

      const trendClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat';
      const trendText = trend > 0 ? `📈 +${trend}%` : trend < 0 ? `📉 ${trend}%` : '— 持平';
      const trendBadge = trend !== 0 ? `<span class="progress-tag ${trendClass}">${trendText}</span>` : '';

      // 入学基线信息
      const enrollInfo = enroll ? `
        <div class="subject-enroll-info">
          <span class="enroll-score">入学：${enroll.level || '?'}级</span>
          ${enroll.weak_points ? `<span class="enroll-weak">薄弱：${enroll.weak_points}</span>` : ''}
        </div>
      ` : `<span class="enroll-empty">点击设置基本情况</span>`;

      html += `
        <div class="subject-card">
          <div class="subject-card-header" onclick="subjectProfile.open('${s.id}', '${s.name}')">
            <div class="subject-info">
              <span class="subject-icon">${s.icon || '📝'}</span>
              <span class="subject-name">${s.name}</span>
            </div>
            <div class="subject-stats">
              ${reportCount > 0 ? `
                <span class="subject-accuracy">${avgAccuracy}%</span>
                <div class="subject-bar">
                  <div class="subject-bar-fill" style="width: ${avgAccuracy}%"></div>
                </div>
                ${trendBadge}
              ` : `<span class="no-data">暂无批改</span>`}
              <span class="subject-arrow">→</span>
            </div>
          </div>
          <div class="subject-card-body">
            ${enrollInfo}
            <button class="btn-edit-subject" onclick="profile.editSubjectBasic('${s.id}', '${s.name}', '${enroll?.id || ''}')">
              ${enroll ? '编辑' : '设置'}
            </button>
          </div>
        </div>
      `;
    });

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

  // 编辑/设置科目基本情况
  async editSubjectBasic(subjectId, subjectName, assessId) {
    let currentData = { level: '', weak_points: '', note: '' };

    // 如果有现有数据，先获取
    if (assessId) {
      const { data } = await supabaseClient
        .from('assessments')
        .select('*')
        .eq('id', assessId)
        .single();
      if (data) {
        currentData = {
          level: data.level || '',
          weak_points: data.weak_points || '',
          note: data.note || ''
        };
      }
    }

    const levelOptions = LEVEL_LABELS.slice(1)
      .map((label, i) => `<option value="${i + 1}" ${currentData.level == i + 1 ? 'selected' : ''}>${i + 1} 级 · ${label}</option>`).join('');

    modal.show(`${subjectName} - 基本情况`, `
      <div class="modal-form">
        <div class="form-item">
          <label>入学水平等级 *</label>
          <select id="basicLevel">${levelOptions}</select>
        </div>
        <div class="form-item">
          <label>初步薄弱点</label>
          <textarea id="basicWeakPoints" rows="3" placeholder="如：分数运算、应用题审题（仅供参考，以实际作业为准）">${currentData.weak_points}</textarea>
        </div>
        <div class="form-item">
          <label>备注</label>
          <textarea id="basicNote" rows="2" placeholder="如：入学测试分数、家长反馈等">${currentData.note}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="profile.saveSubjectBasic('${subjectId}', '${assessId}')">保存</button>
        </div>
      </div>
    `);
  },

  async saveSubjectBasic(subjectId, assessId) {
    const payload = {
      student_id: state.currentStudentId,
      subject_id: subjectId,
      assess_type: 'enroll',
      assess_date: state.students.find(s => s.id === state.currentStudentId)?.enrolled_at || new Date().toISOString().split('T')[0],
      level: Number(document.getElementById('basicLevel').value),
      weak_points: document.getElementById('basicWeakPoints').value.trim() || null,
      note: document.getElementById('basicNote').value.trim() || null
    };

    loading.show('保存中...');
    try {
      if (assessId) {
        // 更新现有记录
        await supabaseClient
          .from('assessments')
          .update(payload)
          .eq('id', assessId);
        toast.success('已更新');
      } else {
        // 新建记录
        await assessmentsAPI.create(payload);
        toast.success('已保存');
      }
      modal.close();
      await this.render();
    } catch (error) {
      console.error('保存失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  // 生成综合分析（AI）
  async generateAnalysis() {
    const studentId = state.currentStudentId;
    const student = state.students.find(s => s.id === studentId);

    // 获取本周数据
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // 获取本周批改数据
    const { data: weekReports } = await supabaseClient
      .from('homework_reports')
      .select('*')
      .eq('student_id', studentId)
      .gte('plan_date', weekStartStr)
      .lte('plan_date', weekEndStr)
      .order('plan_date', { ascending: false });

    if (!weekReports || weekReports.length === 0) {
      toast.error('本周暂无批改数据');
      return;
    }

    // 按科目汇总
    const weekBySubject = {};
    weekReports.forEach(r => {
      const s = state.subjects.find(sub => sub.id === r.subject_id);
      if (!s) return;
      if (!weekBySubject[s.name]) {
        weekBySubject[s.name] = { count: 0, accuracies: [], weakPoints: new Set(), suggestions: [] };
      }
      weekBySubject[s.name].count++;
      if (r.accuracy) weekBySubject[s.name].accuracies.push(Number(r.accuracy));
      if (r.weak_points) {
        const wps = Array.isArray(r.weak_points) ? r.weak_points : String(r.weak_points).split(/[；;]/).filter(Boolean);
        wps.forEach(wp => weekBySubject[s.name].weakPoints.add(wp));
      }
      if (r.suggestion) weekBySubject[s.name].suggestions.push(r.suggestion);
    });

    // 构建 prompt
    const subjectSummary = Object.entries(weekBySubject).map(([name, data]) => {
      const avgAcc = data.accuracies.length > 0
        ? Math.round(data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length)
        : 0;
      return `【${name}】批改${data.count}次，平均准确率${avgAcc}%，薄弱点：${[...data.weakPoints].join('、') || '无明显薄弱点'}，建议：${data.suggestions.slice(0, 2).join('；') || '继续保持'}`;
    }).join('\n');

    const prompt = `你是教培机构的学情分析专家。请根据以下学生本周的作业批改数据，生成一份综合学情分析报告。

学生信息：${student?.name || '未知'} ${student?.grade || ''}年级
时间范围：${weekStartStr} 至 ${weekEndStr}
本周批改次数：${weekReports.length}次

本周各科数据汇总：
${subjectSummary}

请生成一份综合分析报告，要求：
1. 整体评价学生的本周表现
2. 指出各科的优势和需要关注的地方
3. 总结本周出现的核心薄弱点
4. 给出具体、可操作的学习建议
5. 语言要温暖、专业，适合给家长看
6. 控制在 200 字以内

直接输出报告内容，不要额外解释。`;

    loading.show('AI 分析中...');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false })
      });

      const result = await response.json();
      const content = result.content || result.response || result.message || result.text || '';

      if (!content) {
        throw new Error('AI 未返回有效内容');
      }

      // 保存到 summary_history
      const userResult = await supabaseClient.auth.getUser();
      await supabaseClient.from('summary_history').insert({
        kind: 'profile_analysis',
        student_id: studentId,
        period_start: weekStartStr,
        period_end: weekEndStr,
        content: content.trim(),
        payload: { weekReports, weekBySubject, prompt }
      });

      toast.success('综合分析已生成');
      await this.render();
    } catch (error) {
      console.error('生成分析失败:', error);
      toast.error('生成失败：' + error.message);
    } finally {
      loading.hide();
    }
  },

  // 重新生成综合分析
  async regenerateAnalysis() {
    if (!confirm('确定要重新生成吗？之前的分析会被覆盖。')) return;
    await this.generateAnalysis();
  }

};

// 科目详情页（成长曲线 + 薄弱点追踪）
const subjectProfile = {
  currentSubjectId: null,

  open(subjectId, subjectName) {
    this.currentSubjectId = subjectId;
    document.getElementById('subjectProfileTitle').textContent = `📐 ${subjectName}`;
    router.navigate('subjectProfile');
  },

  async render() {
    const container = document.getElementById('subjectProfileContent');
    const studentId = state.currentStudentId;
    const subjectId = this.currentSubjectId;

    if (!studentId || !subjectId) {
      container.innerHTML = '<div class="empty-state"><p>数据加载失败</p></div>';
      return;
    }

    // 获取该科目的所有批改报告
    const { data: reports, error } = await supabaseClient
      .from('homework_reports')
      .select('*')
      .eq('student_id', studentId)
      .eq('subject_id', subjectId)
      .order('plan_date', { ascending: false })
      .limit(30);

    if (error) {
      container.innerHTML = '<div class="empty-state"><p>加载失败</p></div>';
      return;
    }

    const student = state.students.find(s => s.id === studentId);
    const subject = state.subjects.find(s => s.id === subjectId);

    // 1. 成长曲线
    const chartData = reports
      .filter(r => r.accuracy > 0)
      .map(r => ({ date: r.plan_date, accuracy: Number(r.accuracy) }))
      .reverse();

    // 2. 计算薄弱点统计
    const weakPointsMap = {};
    const baselineWeakPoints = new Set();
    const currentWeakPoints = new Set();

    reports.forEach((r, index) => {
      const wps = r.weak_points || [];
      const wpsArray = Array.isArray(wps) ? wps : String(wps).split(/[；;]/).filter(Boolean);
      
      wpsArray.forEach(wp => {
        if (!weakPointsMap[wp]) {
          weakPointsMap[wp] = { count: 0, firstDate: r.plan_date, lastDate: r.plan_date };
        }
        weakPointsMap[wp].count++;
        weakPointsMap[wp].lastDate = r.plan_date;
      });

      // 第一条（最老的）作为入学前
      if (index === reports.length - 1) {
        wpsArray.forEach(wp => baselineWeakPoints.add(wp));
      }
      // 最新的作为现在
      if (index === 0) {
        wpsArray.forEach(wp => currentWeakPoints.add(wp));
      }
    });

    // 3. 计算掌握度（最近正确率趋势）
    const recentAccuracy = chartData.length > 0
      ? Math.round(chartData.slice(-5).reduce((a, b) => a + b.accuracy, 0) / Math.min(chartData.length, 5))
      : 0;
    const baselineAccuracy = chartData.length > 0 ? chartData[0].accuracy : 0;
    const accuracyDelta = recentAccuracy - baselineAccuracy;

    // 4. 薄弱点对比
    const improvedPoints = [...baselineWeakPoints].filter(wp => !currentWeakPoints.has(wp));
    const persistentPoints = [...baselineWeakPoints].filter(wp => currentWeakPoints.has(wp));
    const newPoints = [...currentWeakPoints].filter(wp => !baselineWeakPoints.has(wp));

    // 计算掌握度
    const baselineCount = baselineWeakPoints.size || 1;
    const improvedCount = improvedPoints.length;
    const masteryRate = baselineWeakPoints.size > 0
      ? Math.round(((baselineCount - persistentPoints.length) / baselineCount) * 100)
      : 0;
    const currentMasteryRate = currentWeakPoints.size > 0
      ? Math.round((improvedCount / (baselineWeakPoints.size || 1)) * 100)
      : 0;

    let html = `
      <!-- 成长曲线 -->
      <div class="profile-section-head">
        <h3>📈 成长曲线</h3>
      </div>
      <div class="chart-card">
        <div id="accuracyChart" style="width: 100%; height: 220px;"></div>
        <div class="trend-summary">
          ${accuracyDelta > 0 
            ? `<span class="trend-up">📈 趋势：+${accuracyDelta}%（明显进步）</span>` 
            : accuracyDelta < 0 
              ? `<span class="trend-down">📉 趋势：${accuracyDelta}%（需关注）</span>`
              : `<span class="trend-flat">— 趋势：持平</span>`
          }
          <span class="current-accuracy">当前平均准确率：${recentAccuracy}%</span>
        </div>
      </div>

      <!-- 薄弱点出现频次 -->
      <div class="profile-section-head">
        <h3>🎯 薄弱点统计（出现频次）</h3>
        <span class="section-hint">频次越高越需要重点练习</span>
      </div>
      <div class="weak-points-card">
        <div class="weak-points-list">
          ${Object.keys(weakPointsMap).length > 0
            ? Object.entries(weakPointsMap)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([wp, info]) => {
                  const severity = info.count >= 4 ? 'critical' : info.count >= 2 ? 'warning' : 'normal';
                  return `<div class="weak-point-item ${severity}">
                    <div class="weak-point-name">${wp}</div>
                    <div class="weak-point-bar-wrap">
                      <div class="weak-point-bar" style="width: ${Math.min(info.count * 20, 100)}%"></div>
                    </div>
                    <div class="weak-point-count">${info.count}次</div>
                    <div class="weak-point-status">
                      ${info.count >= 4 ? '⚠️核心' : info.count >= 2 ? '⚡关注' : '📌新发现'}
                    </div>
                  </div>`;
                }).join('')
            : '<div class="empty-weak">暂无薄弱点数据，继续保持！</div>'
          }
        </div>
        <div class="weak-points-summary">
          共发现 ${Object.keys(weakPointsMap).length} 个薄弱点，
          其中 <span class="critical-count">⚠️核心薄弱点 ${Object.values(weakPointsMap).filter(w => w.count >= 4).length} 个</span>
        </div>
      </div>

      <!-- 评估记录 -->
      <div class="profile-section-head">
        <h3>📝 评估记录（来自拍照批改）</h3>
      </div>
    `;

    if (reports.length === 0) {
      html += '<div class="empty-state"><p>暂无评估记录</p></div>';
    } else {
      html += '<div class="history-list">';
      reports.forEach(r => {
        const weakPointsStr = Array.isArray(r.weak_points) 
          ? r.weak_points.join('、') 
          : r.weak_points || '';
        html += `
          <div class="history-item">
            <div class="history-main">
              <div class="history-title">
                📅 ${r.plan_date}
                <span class="accuracy-badge ${r.accuracy >= 85 ? 'good' : r.accuracy >= 70 ? 'ok' : 'poor'}">
                  正确率 ${r.accuracy}%
                </span>
              </div>
              ${weakPointsStr ? `<div class="history-weak">薄弱点：${weakPointsStr}</div>` : ''}
              ${r.suggestion ? `<div class="history-note">建议：${r.suggestion}</div>` : ''}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // 渲染图表
    if (chartData.length > 0) {
      const chart = echarts.init(document.getElementById('accuracyChart'));
      const dates = chartData.map(d => d.date.slice(5));
      const accuracies = chartData.map(d => d.accuracy);

      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
        yAxis: { 
          type: 'value', 
          min: 0, max: 100,
          axisLabel: { formatter: '{value}%', fontSize: 10 }
        },
        series: [{
          data: accuracies,
          type: 'line',
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: '#4F46E5' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(79, 70, 229, 0.3)' },
              { offset: 1, color: 'rgba(79, 70, 229, 0.05)' }
            ])
          },
          label: { show: true, formatter: '{c}%', fontSize: 9 }
        }]
      });

      window.addEventListener('resize', () => chart.resize());
    }
  }
};

async function initSubjectProfilePage() {
  await subjectProfile.render();
}

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
window.subjectProfile = subjectProfile;
