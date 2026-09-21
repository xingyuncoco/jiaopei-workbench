/**
 * API 封装模块
 * 封装所有与后端的交互
 */

const API_BASE = '/api';

// 获取 token（从 localStorage）
function getToken() {
  return localStorage.getItem('auth_token') || '';
}

// 通用请求方法
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }

    return data;
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error;
  }
}

// =============================================
// 学生相关 API
// =============================================

const studentsAPI = {
  // 获取学生列表
  async list() {
    return request('/students');
  },

  // 添加学生
  async create(data) {
    return request('/students', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 编辑学生
  async update(id, data) {
    return request(`/students?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 删除学生
  async delete(id) {
    return request(`/students?id=${id}`, {
      method: 'DELETE'
    });
  }
};

// =============================================
// 科目相关 API
// =============================================

const subjectsAPI = {
  // 获取科目列表
  async list() {
    return request('/subjects');
  },

  // 添加科目
  async create(data) {
    return request('/subjects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 编辑科目
  async update(id, data) {
    return request(`/subjects?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 删除科目
  async delete(id) {
    return request(`/subjects?id=${id}`, {
      method: 'DELETE'
    });
  }
};

// =============================================
// 规划相关 API
// =============================================

const plansAPI = {
  // 获取规划列表
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/plans${query ? '?' + query : ''}`);
  },

  // 添加规划
  async create(data) {
    return request('/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 更新规划
  async update(id, data) {
    return request(`/plans?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 删除规划
  async delete(id) {
    return request(`/plans?id=${id}`, {
      method: 'DELETE'
    });
  },

  // 切换完成状态
  async toggleComplete(id, isCompleted) {
    return this.update(id, { is_completed: isCompleted });
  }
};

// =============================================
// 批改相关 API
// =============================================

const reportsAPI = {
  // 获取报告列表
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/reports${query ? '?' + query : ''}`);
  },

  // 获取单条报告
  async get(id) {
    return request(`/reports?id=${id}`);
  },

  // 提交批改
  async create(data) {
    return request('/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 删除报告
  async delete(id) {
    return request(`/reports?id=${id}`, {
      method: 'DELETE'
    });
  }
};

// =============================================
// 总结相关 API
// =============================================

const summariesAPI = {
  // 获取指定日期总结
  async get(date) {
    return request(`/summaries?date=${date}`);
  },

  // 生成总结
  async generate(date) {
    return request('/summaries/generate', {
      method: 'POST',
      body: JSON.stringify({ date })
    });
  },

  // 更新总结
  async update(id, data) {
    return request(`/summaries?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};

// =============================================
// 文件上传 API（示例，实际需要配合 Supabase Storage）
// =============================================

const uploadAPI = {
  async uploadImage(file) {
    // 这里需要实现图片上传到 Supabase Storage
    // 返回公开 URL
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '上传失败');
    }

    return data.url;
  }
};

// 导出 API
window.api = {
  students: studentsAPI,
  subjects: subjectsAPI,
  plans: plansAPI,
  reports: reportsAPI,
  summaries: summariesAPI,
  upload: uploadAPI
};
