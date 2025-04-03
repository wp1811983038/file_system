// pages/user/stats/index.js
const app = getApp();

Page({
  data: {
    // 概览数据
    overviewData: {
      total: 0,
      submitted: 0,
      approved: 0,
      submissionRate: 0
    },
    // 状态分布数据
    statusData: {
      total: 0,
      status_counts: {
        approved: 0,
        rejected: 0,
        pending: 0
      },
      not_submitted: 0,
      submission_rate: 0
    },
    // 模板提交情况
    templateData: {
      templates: []
    },
    // 审批时效数据
    efficiencyData: {
      average_hours: 0,
      approval_rate: 0,
      total_files: 0,
      details: []
    },
    isLoading: false
  },

  onLoad() {
    this.loadAllStatistics();
  },

  onPullDownRefresh() {
    this.loadAllStatistics().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有统计数据
  async loadAllStatistics() {
    this.setData({ isLoading: true });
    
    try {
      // 并行加载所有数据
      await Promise.all([
        this.loadTemplateStats(),
        this.loadSubmissionStatus(),
        this.loadApprovalEfficiency()
      ]);
      
      // 添加触感反馈
      wx.vibrateShort({ type: 'light' });
    } catch (err) {
      console.error('加载统计数据失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 加载模板统计数据
  async loadTemplateStats() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/stats/templates`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      console.log('模板统计响应:', res);
      
      if (res.statusCode === 200) {
        // 更新概览数据
        this.setData({
          overviewData: {
            total: res.data.summary.total || 0,
            submitted: res.data.summary.submitted || 0,
            approved: res.data.summary.approved || 0,
            submissionRate: res.data.summary.submission_rate || 0
          },
          templateData: {
            templates: res.data.templates || []
          }
        });
      } else {
        throw new Error('获取模板统计失败');
      }
    } catch (err) {
      console.error('加载模板统计失败:', err);
      throw err;
    }
  },

  // 加载提交状态数据
  async loadSubmissionStatus() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) return;
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/stats/submissions/status`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      console.log('提交状态响应:', res);
      
      if (res.statusCode === 200) {
        // 计算未提交数量
        const not_submitted = this.data.overviewData.total - res.data.total;
        
        this.setData({
          statusData: {
            ...res.data,
            not_submitted: not_submitted,
            submission_rate: res.data.total > 0 
              ? Math.round((res.data.total / (res.data.total + not_submitted)) * 100) 
              : 0
          }
        });
      } else {
        throw new Error('获取提交状态失败');
      }
    } catch (err) {
      console.error('加载提交状态失败:', err);
      throw err;
    }
  },

  // 加载审批时效数据
  async loadApprovalEfficiency() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) return;
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/stats/approval/efficiency`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      console.log('审批时效响应:', res);
      
      if (res.statusCode === 200) {
        // 按时间排序，最近的在前面
        const sortedDetails = res.data.details ? 
          [...res.data.details].sort((a, b) => new Date(b.approval_date) - new Date(a.approval_date)) : 
          [];
        
        // 最多显示5条记录
        const limitedDetails = sortedDetails.slice(0, 5);
        
        this.setData({
          efficiencyData: {
            ...res.data,
            details: limitedDetails
          }
        });
      } else {
        throw new Error('获取审批时效失败');
      }
    } catch (err) {
      console.error('加载审批时效失败:', err);
      throw err;
    }
  }
});