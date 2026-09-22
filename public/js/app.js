/**
 * 教培工作台 - 主应用逻辑
 * 全局 API（从 window 读取）
 */

const { studentsAPI, subjectsAPI, plansAPI, reportsAPI, summariesAPI, assessmentsAPI, weekStatsAPI } = window;

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
  updateQuickList();
}

async function updateQuickList() {
  const quickList = document.getElementById('quickList');

  try {
    const plansRes = await plansAPI.list({ date: state.currentDate });
    const plans = plansRes.plans || [];

    if (plans.length === 0) {
      quickList.innerHTML = '<p class="empty-tip">暂无待办事项</p>';
      return;
    }

    let html = '';
    plans.forEach(plan => {
      const isCompleted = plan.is_completed;
      const studentName = plan.student?.name || '未知学生';
      const subjectName = plan.subject?.name || '未知科目';
      const subjectIcon = plan.subject?.icon || '📝';

      html += `
        <div class="quick-item" onclick="router.navigate('plans')">
          <div><strong>${studentName}</strong> - ${subjectIcon} ${subjectName}</div>
          <span class="status-tag ${isCompleted ? 'completed' : 'pending'}">
            ${isCompleted ? '✅已完成' : '⬜待完成'}
          </span>
        </div>
      `;
    });

    quickList.innerHTML = html;
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

async function loadPlans() {
  const studentId = document.getElementById('planStudentSelect').value;
  const listEl = document.getElementById('plansList');

  if (!studentId) {
    listEl.innerHTML = '<p class="empty-tip" style="text-align:center;padding:20px;">请先选择学生</p>';
    return;
  }

  loading.show('加载中...');

  try {
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

      html += `
        <div class="plan-item">
          <div class="plan-item-left">
            <span class="plan-item-icon">${subjectIcon}</span>
            <div class="plan-item-info">
              <h4>${subjectName}</h4>
              <p>${timeRange}</p>
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

    let timeOptions = '';
    for (let h = 8; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        timeOptions += `<option value="${time}">${time}</option>`;
      }
    }

    let subjectOptions = '';
    state.subjects.forEach(subject => {
      subjectOptions += `<option value="${subject.id}">${subject.icon} ${subject.name}</option>`;
    });

    modal.show('添加科目', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目 *</label>
          <select id="planSubject">${subjectOptions}</select>
        </div>
        <div class="form-item">
          <label>开始时间</label>
          <select id="planStartTime">${timeOptions}</select>
        </div>
        <div class="form-item">
          <label>结束时间</label>
          <select id="planEndTime">${timeOptions}</select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="plans.save()">添加</button>
        </div>
      </div>
    `);
  },

  async save() {
    const studentId = document.getElementById('planStudentSelect').value;
    const subjectId = document.getElementById('planSubject').value;
    const startTime = document.getElementById('planStartTime').value;
    const endTime = document.getElementById('planEndTime').value;

    if (!subjectId) {
      toast.error('请选择科目');
      return;
    }

    loading.show('添加中...');

    try {
      await plansAPI.create({
        student_id: studentId,
        subject_id: subjectId,
        plan_date: state.currentDate,
        start_time: startTime || null,
        end_time: endTime || null
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

  copyPlans() {
    const studentId = document.getElementById('planStudentSelect').value;
    const student = state.students.find(s => s.id === studentId);

    if (!student || state.plans.length === 0) {
      toast.error('没有可复制的规划');
      return;
    }

    let text = `【${student.name} 今日作业规划】${formatFullDate(state.currentDate)}\n`;

    state.plans.forEach(plan => {
      const icon = plan.subject?.icon || '📝';
      const name = plan.subject?.name || '未知';
      const time = plan.start_time && plan.end_time
        ? `${plan.start_time}-${plan.end_time}`
        : '未安排';
      const status = plan.is_completed ? '✅' : '⬜';

      text += `${icon} ${name} ${time} ${status}\n`;
    });

    copyToClipboard(text);
  }
};

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
  showAddModal() {
    const icons = ['📐', '📝', '📖', '🔬', '⚡', '🧪', '🎨', '🎵', '🏀', '🗣️', '💻', '🌍'];
    let iconHtml = '';
    icons.forEach((icon, index) => {
      iconHtml += `<div class="icon-option ${index === 0 ? 'active' : ''}" data-icon="${icon}">${icon}</div>`;
    });

    modal.show('添加科目', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目名称 *</label>
          <input type="text" id="subjectName" placeholder="如：数学">
        </div>
        <div class="form-item">
          <label>选择图标</label>
          <div class="icon-picker" id="iconPicker">${iconHtml}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save()">保存</button>
        </div>
      </div>
    `);

    document.querySelectorAll('.icon-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('active'));
        el.classList.add('active');
      });
    });
  },

  showEditModal(id) {
    const subject = state.subjects.find(s => s.id === id);
    if (!subject) return;

    const icons = ['📐', '📝', '📖', '🔬', '⚡', '🧪', '🎨', '🎵', '🏀', '🗣️', '💻', '🌍'];
    let iconHtml = '';
    icons.forEach(icon => {
      iconHtml += `<div class="icon-option ${icon === subject.icon ? 'active' : ''}" data-icon="${icon}">${icon}</div>`;
    });

    modal.show('编辑科目', `
      <div class="modal-form">
        <div class="form-item">
          <label>科目名称 *</label>
          <input type="text" id="subjectName" value="${subject.name}">
        </div>
        <div class="form-item">
          <label>选择图标</label>
          <div class="icon-picker" id="iconPicker">${iconHtml}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save('${id}')">保存</button>
        </div>
      </div>
    `);

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

    if (!name) {
      toast.error('请输入科目名称');
      return;
    }

    loading.show('保存中...');

    try {
      if (id) {
        await subjectsAPI.update(id, { name, icon });
        toast.success('修改成功');
      } else {
        await subjectsAPI.create({ name, icon });
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

// 每日总结页面
async function initSummaryPage() {
  document.getElementById('summaryDate').textContent = formatDate(state.currentDate);
  await loadSummary();
}

const summary = {
  changeDate(delta) {
    const date = new Date(state.currentDate);
    date.setDate(date.getDate() + delta);
    state.currentDate = date.toISOString().split('T')[0];
    document.getElementById('summaryDate').textContent = formatDate(state.currentDate);
    loadSummary();
  },

  async loadSummary() {
    const contentEl = document.getElementById('summaryContent');
    const actionsEl = document.getElementById('summaryActions');

    loading.show('加载中...');

    try {
      const res = await summariesAPI.get(state.currentDate);

      if (res.summary) {
        this.renderSummary(res.summary);
        actionsEl.style.display = 'flex';
      } else {
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <p class="empty-state-text">暂无总结</p>
            <button class="btn btn-primary" onclick="summary.generate()">生成今日总结</button>
          </div>
        `;
        actionsEl.style.display = 'none';
      }
    } catch (error) {
      contentEl.innerHTML = '<p class="empty-tip">加载失败</p>';
    } finally {
      loading.hide();
    }
  },

  renderSummary(data) {
    const contentEl = document.getElementById('summaryContent');
    const subjectSummary = data.subject_summary || [];

    let subjectsHtml = '';
    if (subjectSummary.length > 0) {
      subjectsHtml = `
        <h3 style="margin-bottom:12px">📝 各科完成情况</h3>
        <div class="subject-list">
          ${subjectSummary.map(s => {
            const percent = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            return `
              <div class="subject-item">
                <span class="subject-name">${s.name}</span>
                <div class="subject-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${percent}%"></div>
                  </div>
                  <span class="progress-text">${s.completed}/${s.total}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    contentEl.innerHTML = `
      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-value">${data.total_students || 0}</div>
          <div class="stat-label">在册学生</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.completed_count || 0}</div>
          <div class="stat-label">完成作业</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.avg_accuracy || 0}%</div>
          <div class="stat-label">平均正确率</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${subjectSummary.length}</div>
          <div class="stat-label">涉及科目</div>
        </div>
      </div>

      ${subjectsHtml}

      <div class="summary-suggestion">
        <h4>💡 建议</h4>
        <p>${data.detail_text || '暂无建议'}</p>
      </div>

      <div class="summary-copy-preview">
        <h4>📋 复制文本预览</h4>
        <pre style="white-space:pre-wrap;margin-top:8px">${data.copy_text || ''}</pre>
      </div>
    `;

    contentEl.dataset.copyText = data.copy_text;
  },

  async generate() {
    loading.show('生成中...');

    try {
      const res = await summariesAPI.generate(state.currentDate);
      this.renderSummary(res.summary);
      document.getElementById('summaryActions').style.display = 'flex';
      toast.success('总结生成成功');
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  async regenerate() {
    await this.generate();
  },

  copySummary() {
    const copyText = document.getElementById('summaryContent').dataset.copyText;
    if (copyText) {
      copyToClipboard(copyText);
    }
  }
};

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
          <button class="btn btn-outline btn-sm" onclick="profile.aiSummary()">✨ AI 周总结</button>
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

  // 生成 AI 周总结：聚合本周作业 + 历次学情，交给服务端代理调用 MiniMax
  async aiSummary() {
    const student = state.students.find(s => s.id === state.currentStudentId);
    if (!student) return;

    loading.show('AI 生成中...');
    try {
      const token = await authAPI.getAccessToken();
      if (!token) {
        toast.error('登录已失效，请重新登录');
        return;
      }

      const [weekStart, weekEnd] = currentWeekRange();
      const [weekStats, assessRes] = await Promise.all([
        weekStatsAPI.fetch(student.id, weekStart, weekEnd),
        assessmentsAPI.listByStudent(student.id)
      ]);

      const payload = {
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data.summary) throw new Error(data.error || '生成失败');

      lastAiSummary = data.summary;
      const safe = data.summary.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      modal.show('✨ AI 周总结', `
        <div class="ai-summary-box">
          <pre class="ai-summary-text">${safe}</pre>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="modal.close()">关闭</button>
            <button class="btn btn-primary" onclick="profile.copyAiSummary()">复制发给家长</button>
          </div>
        </div>
      `);
    } catch (error) {
      console.error('AI 周总结失败:', error);
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  copyAiSummary() {
    if (lastAiSummary) {
      copyToClipboard(lastAiSummary);
      toast.success('已复制');
    }
  }
};

// 本周一到本周日的日期区间
function currentWeekRange() {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]];
}

let lastAiSummary = '';

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
