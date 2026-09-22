/**
 * 教培工作台 - 主应用逻辑
 * 全局 API（从 window 读取）
 */

const { studentsAPI, subjectsAPI, plansAPI, reportsAPI, summariesAPI } = window;

// 全局状态
const state = {
  students: [],
  subjects: [],
  plans: [],
  currentDate: new Date().toISOString().split('T')[0],
  selectedStudentId: null,
  selectedSubjectId: null
};

// 路由控制
const router = {
  pages: ['home', 'students', 'plans', 'subjects', 'correct', 'summary'],

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

async function loadAllData() {
  try {
    const studentsRes = await studentsAPI.list();
    state.students = studentsRes.students || [];

    const subjectsRes = await subjectsAPI.list();
    state.subjects = subjectsRes.subjects || [];

    if (state.subjects.length === 0) {
      const defaultSubjects = [
        { name: '数学', icon: '📐' },
        { name: '英语', icon: '📝' },
        { name: '语文', icon: '📖' },
        { name: '科学', icon: '🔬' }
      ];
      for (const subj of defaultSubjects) {
        try { await subjectsAPI.create(subj); } catch (e) {}
      }
      const newSubjectsRes = await subjectsAPI.list();
      state.subjects = newSubjectsRes.subjects || [];
    }
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
      <div class="list-item">
        <div class="list-item-info">
          <div class="list-item-avatar">👨‍🎓</div>
          <div>
            <div class="list-item-name">${student.name}</div>
            <div class="list-item-desc">${student.grade || ''} ${student.group_name || ''}</div>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="list-item-btn" onclick="students.showEditModal('${student.id}')">✏️</button>
          <button class="list-item-btn" onclick="students.confirmDelete('${student.id}')">🗑️</button>
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

    if (!name) {
      toast.error('请输入学生姓名');
      return;
    }

    loading.show('保存中...');

    try {
      if (id) {
        await studentsAPI.update(id, { name, grade, group_name });
        toast.success('修改成功');
      } else {
        await studentsAPI.create({ name, grade, group_name });
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
window.plans = plans;
window.subjects = subjects;
window.correct = correct;
window.summary = summary;
