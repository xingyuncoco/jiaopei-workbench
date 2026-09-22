/**
 * 教培工作台 - 主应用逻辑
 */

// 全局状态
const state = {
  students: [],
  subjects: [],
  plans: [],
  currentDate: new Date().toISOString().split('T')[0],
  selectedStudentId: null,
  selectedSubjectId: null
};

// =============================================
// 路由控制
// =============================================

const router = {
  pages: ['home', 'students', 'plans', 'subjects', 'correct', 'summary'],

  navigate(page) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 显示目标页面
    const targetPage = document.getElementById(`${page}Page`);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    // 更新底部导航
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navMap = { home: 0, students: 1, plans: 2, summary: 3 };
    if (navMap[page] !== undefined) {
      document.querySelectorAll('.nav-item')[navMap[page]]?.classList.add('active');
    }

    // 页面加载后执行初始化
    if (page === 'home') initHomePage();
    if (page === 'students') initStudentsPage();
    if (page === 'plans') initPlansPage();
    if (page === 'correct') initCorrectPage();
    if (page === 'summary') initSummaryPage();

    window.scrollTo(0, 0);
  }
};

// =============================================
// 模态框控制
// =============================================

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

// =============================================
// Toast 提示
// =============================================

const toast = {
  show(message, type = 'info') {
    const toastEl = document.getElementById('toast');
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`;

    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2500);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  }
};

// =============================================
// 加载状态
// =============================================

const loading = {
  show(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loading').style.display = 'flex';
  },

  hide() {
    document.getElementById('loading').style.display = 'none';
  }
};

// =============================================
// 工具函数
// =============================================

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

// =============================================
// 页面初始化
// =============================================

async function initApp() {
  // 设置今日日期
  const today = new Date();
  document.getElementById('todayDate').textContent =
    `${today.getMonth() + 1}月${today.getDate()}日 ${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

  // 加载数据
  await loadAllData();

  // 初始化首页
  initHomePage();
}

async function loadAllData() {
  try {
    // 加载学生列表
    const studentsRes = await api.students.list();
    state.students = studentsRes.students || [];

    // 加载科目列表
    const subjectsRes = await api.subjects.list();
    state.subjects = subjectsRes.subjects || [];

    // 如果没有科目，添加默认科目
    if (state.subjects.length === 0) {
      const defaultSubjects = [
        { name: '数学', icon: '📐' },
        { name: '英语', icon: '📝' },
        { name: '语文', icon: '📖' },
        { name: '科学', icon: '🔬' }
      ];

      for (const subj of defaultSubjects) {
        try {
          await api.subjects.create(subj);
        } catch (e) {}
      }

      const newSubjectsRes = await api.subjects.list();
      state.subjects = newSubjectsRes.subjects || [];
    }
  } catch (error) {
    console.error('加载数据失败:', error);
    toast.error('数据加载失败，请刷新重试');
  }
}

// =============================================
// 首页初始化
// =============================================

function initHomePage() {
  updateQuickList();
}

async function updateQuickList() {
  const quickList = document.getElementById('quickList');

  try {
    // 获取今日所有规划
    const plansRes = await api.plans.list({ date: state.currentDate });
    const plans = plansRes.plans || [];

    // 获取今日批改报告
    const reportsRes = await api.reports.list({ date: state.currentDate });
    const reports = reportsRes.reports || [];

    if (plans.length === 0 && reports.length === 0) {
      quickList.innerHTML = '<p class="empty-tip">暂无待办事项</p>';
      return;
    }

    // 生成待办列表
    let html = '';

    plans.forEach(plan => {
      const isCompleted = plan.is_completed;
      const studentName = plan.student?.name || '未知学生';
      const subjectName = plan.subject?.name || '未知科目';
      const subjectIcon = plan.subject?.icon || '📝';

      html += `
        <div class="quick-item" onclick="router.navigate('plans')">
          <div>
            <strong>${studentName}</strong> - ${subjectIcon} ${subjectName}
          </div>
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

// =============================================
// 学生管理页面
// =============================================

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

// 学生管理模块
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
        await api.students.update(id, { name, grade, group_name });
        toast.success('修改成功');
      } else {
        await api.students.create({ name, grade, group_name });
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
      await api.students.delete(id);
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

// =============================================
// 作业规划页面
// =============================================

async function initPlansPage() {
  // 更新日期显示
  document.getElementById('planDate').textContent = formatDate(state.currentDate);

  // 加载学生选择器
  updateStudentSelect('planStudentSelect');

  // 加载科目选择器
  updateSubjectSelect('correctStudentSelect');
  updateSubjectSelect('correctSubjectSelect');

  // 加载规划
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
    const res = await api.plans.list({
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
            <button class="list-item-btn" onclick="plans.delete('${plan.id}')">🗑️</button>
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

// 作业规划模块
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

    // 生成时间选项
    let timeOptions = '';
    for (let h = 8; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        timeOptions += `<option value="${time}">${time}</option>`;
      }
    }

    // 科目选项
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
      await api.plans.create({
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
      await api.plans.toggleComplete(id, isCompleted);
      await loadPlans();
      toast.success(isCompleted ? '已标记为完成' : '已标记为未完成');
    } catch (error) {
      toast.error('操作失败');
    }
  },

  async delete(id) {
    if (!confirm('确定要删除这条规划吗？')) return;

    loading.show('删除中...');

    try {
      await api.plans.delete(id);
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

// =============================================
// 科目管理页面
// =============================================

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

// 科目管理模块
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
          <div class="icon-picker" id="iconPicker">
            ${iconHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save()">保存</button>
        </div>
      </div>
    `);

    // 绑定图标选择事件
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
          <div class="icon-picker" id="iconPicker">
            ${iconHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="modal.close()">取消</button>
          <button class="btn btn-primary" onclick="subjects.save('${id}')">保存</button>
        </div>
      </div>
    `);

    // 绑定图标选择事件
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
        await api.subjects.update(id, { name, icon });
        toast.success('修改成功');
      } else {
        await api.subjects.create({ name, icon });
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
      await api.subjects.delete(id);
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

// =============================================
// 拍照批改页面
// =============================================

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

    // 限制文件大小 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    selectedImageFile = file;

    // 显示预览
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
    const studentId = document.getElementById('correctStudentSelect').value;
    const subjectId = document.getElementById('correctSubjectSelect').value;

    if (!studentId || !subjectId) {
      toast.error('请选择学生和科目');
      return;
    }

    if (!selectedImageFile) {
      toast.error('请上传作业图片');
      return;
    }

    loading.show('批改中，请稍候...');

    try {
      // 1. 上传图片（这里需要实现图片上传逻辑）
      // 实际项目中应该上传到 Supabase Storage
      // 暂时使用 Base64 编码（仅用于演示，生产环境不建议）
      const reader = new FileReader();
      const imageUrl = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(selectedImageFile);
      });

      // 2. 调用批改 API
      const res = await api.reports.create({
        student_id: studentId,
        subject_id: subjectId,
        plan_date: state.currentDate,
        image_url: imageUrl
      });

      // 3. 显示结果
      this.showResult(res.report, res.copy_text);

      toast.success('批改完成');
    } catch (error) {
      toast.error(error.message);
    } finally {
      loading.hide();
    }
  },

  showResult(report, copyText) {
    const resultEl = document.getElementById('correctResult');
    const student = state.students.find(s => s.id === report.student_id);
    const subject = state.subjects.find(s => s.id === report.subject_id);

    // 生成错题列表 HTML
    let errorsHtml = '';
    const errors = report.errors_detail || [];
    if (errors.length > 0) {
      errorsHtml = `
        <div class="error-list">
          <h4 style="margin-bottom:12px">❌ 错题分析：</h4>
          ${errors.map(err => `
            <div class="error-item">
              <h4>第${err.question_number}题</h4>
              <p>学生答案：${err.student_answer}</p>
              <p>正确答案：${err.correct_answer}</p>
              <p>分析：${err.analysis}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      errorsHtml = '<p style="text-align:center;color:var(--success);padding:20px">🎉 全部正确，继续保持！</p>';
    }

    resultEl.innerHTML = `
      <div class="correct-result-header">
        <img src="${report.image_url}" class="correct-result-image" alt="作业图片">
        <div>
          <h3>${student?.name || '未知学生'}</h3>
          <p>${subject?.icon || '📝'} ${subject?.name || '未知科目'}</p>
          <p style="color:var(--gray-500)">${report.plan_date}</p>
        </div>
      </div>

      <div class="accuracy-display">
        <div class="accuracy-value">${report.accuracy}%</div>
        <div class="accuracy-label">正确率 (${report.correct_count}/${report.total_count})</div>
      </div>

      ${errorsHtml}

      <div class="suggestion-box">
        <h4>💡 建议</h4>
        <p>${report.suggestion}</p>
      </div>

      <div class="result-actions">
        <button class="btn btn-outline" onclick="correct.copyReport('${report.id}')">📋 复制报告</button>
        <button class="btn btn-outline" onclick="correct.reset()">📸 重新批改</button>
      </div>
    `;

    resultEl.style.display = 'block';

    // 保存复制文本到按钮
    resultEl.dataset.copyText = copyText || report.full_report;
  },

  async copyReport(id) {
    try {
      const res = await api.reports.get(id);
      copyToClipboard(res.report.full_report);
    } catch (error) {
      const copyText = document.getElementById('correctResult').dataset.copyText;
      if (copyText) {
        copyToClipboard(copyText);
      }
    }
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

// =============================================
// 每日总结页面
// =============================================

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
      // 尝试获取已有总结
      const res = await api.summaries.get(state.currentDate);

      if (res.summary) {
        this.renderSummary(res.summary);
        actionsEl.style.display = 'flex';
      } else {
        // 没有总结，生成新的
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

    // 渲染各科统计
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

    // 保存复制文本
    contentEl.dataset.copyText = data.copy_text;
  },

  async generate() {
    loading.show('生成中...');

    try {
      const res = await api.summaries.generate(state.currentDate);
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

// =============================================
// 应用启动
// =============================================

document.addEventListener('DOMContentLoaded', initApp);
