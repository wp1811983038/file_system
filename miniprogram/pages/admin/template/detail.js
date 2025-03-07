// pages/admin/template/detail.js
const app = getApp();
const requestModule = require('../../../utils/request');
const fileUtils = require('../../../utils/file');

// 从模块中获取需要的方法
const { get, post } = requestModule;

Page({
  data: {
    templateId: '',
    templateName: '',
    activeTab: 'submitted',
    submittedUsers: [],
    pendingUsers: [],
    filteredSubmittedUsers: [],
    filteredPendingUsers: [],
    submittedCount: 0,
    pendingCount: 0,
    totalUsers: 0,
    submissionRate: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        templateId: options.id,
        templateName: decodeURIComponent(options.name || '')
      });
      
      this.loadTemplateData(options.id);
    }
  },

  onShow() {
    // 可能在返回页面时需要刷新数据
    if (this.data.templateId) {
      this.loadTemplateData(this.data.templateId);
    }
  },

  onPullDownRefresh() {
    this.loadTemplateData(this.data.templateId).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 阻止模态框背景滚动
  preventTouchMove() {
    return false;
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });

    // 如果是切换到分析标签，需要生成分析数据
    if (tab === 'analytics') {
      this.generateAnalyticsData();
    }
  },

  // 加载模板数据
  async loadTemplateData(templateId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 获取模板提交状态数据
      const result = await get(`/api/v1/files/templates/${templateId}/status`);
      
      // 计算提交率
      const submissionRate = result.total_users > 0 
        ? Math.round((result.submitted_count / result.total_users) * 100) 
        : 0;
      
      this.setData({
        submittedUsers: result.submissions || [],
        pendingUsers: result.pending_users || [],
        filteredSubmittedUsers: result.submissions || [],
        filteredPendingUsers: result.pending_users || [],
        submittedCount: result.submitted_count || 0,
        pendingCount: result.pending_users ? result.pending_users.length : 0,
        totalUsers: result.total_users || 0,
        submissionRate
      });
      
      // 如果当前标签是分析标签，生成分析数据
      if (this.data.activeTab === 'analytics') {
        this.generateAnalyticsData();
      }
      
      return result;
    } catch (err) {
      console.error('加载模板数据失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 生成分析数据 - 简化版，只关注提交率
  generateAnalyticsData() {
    // 提交率分析已在加载数据时完成
    // 这里可以处理其他分析数据（如果需要）
    
    // 提交率数据已经在页面的状态中:
    // - submittedCount: 已提交数量
    // - pendingCount: 未提交数量
    // - totalUsers: 总用户数
    // - submissionRate: 提交率百分比
  },

  // 搜索已提交用户
  onSearchSubmitted(e) {
    const keyword = e.detail.value.toLowerCase();
    if (!keyword) {
      this.setData({
        filteredSubmittedUsers: this.data.submittedUsers
      });
      return;
    }
    
    const filtered = this.data.submittedUsers.filter(user => 
      user.username.toLowerCase().includes(keyword) || 
      (user.company_name && user.company_name.toLowerCase().includes(keyword))
    );
    
    this.setData({
      filteredSubmittedUsers: filtered
    });
  },

  // 搜索未提交用户
  onSearchPending(e) {
    const keyword = e.detail.value.toLowerCase();
    if (!keyword) {
      this.setData({
        filteredPendingUsers: this.data.pendingUsers
      });
      return;
    }
    
    const filtered = this.data.pendingUsers.filter(user => 
      user.username.toLowerCase().includes(keyword) || 
      (user.company_name && user.company_name.toLowerCase().includes(keyword))
    );
    
    this.setData({
      filteredPendingUsers: filtered
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 导出数据
  exportData() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    });
  },

  // 下载模板
  async downloadTemplate() {
    try {
      wx.showLoading({ title: '准备下载...' });
      
      await fileUtils.downloadAndSaveFile(
        `${app.globalData.baseUrl}/api/v1/files/download/template/${this.data.templateId}`, 
        {
          fileName: this.data.templateName,
          preview: true
        }
      );
    } catch (err) {
      console.error('下载失败:', err);
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 预览提交文件
  async previewSubmission(e) {
    const userId = e.currentTarget.dataset.userId;
    const user = this.data.submittedUsers.find(u => u.user_id === userId);
    
    if (!user) return;
    
    try {
      wx.showLoading({ title: '加载中...' });
      
      await fileUtils.downloadAndSaveFile(
        `${app.globalData.baseUrl}/api/v1/files/preview/submission/${userId}/${this.data.templateId}`, 
        {
          fileName: `${this.data.templateName}-${user.username}`,
          preview: true
        }
      );
    } catch (err) {
      console.error('预览失败:', err);
      wx.showToast({
        title: '预览失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 下载提交文件
  async downloadSubmission(e) {
    const userId = e.currentTarget.dataset.userId;
    const user = this.data.submittedUsers.find(u => u.user_id === userId);
    
    if (!user) return;
    
    try {
      wx.showLoading({ title: '准备下载...' });
      
      await fileUtils.downloadAndSaveFile(
        `${app.globalData.baseUrl}/api/v1/files/download/submission/${userId}/${this.data.templateId}`, 
        {
          fileName: `${this.data.templateName}-${user.username}`,
          preview: true
        }
      );
    } catch (err) {
      console.error('下载失败:', err);
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },


});