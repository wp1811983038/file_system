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
    submissionRate: 0,
    showApprovalModal: false,
    currentApproval: {
      fileId: '',
      userId: '',
      username: '',
      filename: ''
    },
    approvalDecision: '',
    approvalComment: '',
    approvalStats: {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0
    }
  },

  // 获取状态类名
  getStatusClass(status) {
    if (!status || status === 'draft') return 'status-draft';
    if (status === 'submitted') return 'status-submitted';
    if (status === 'under_review') return 'status-under-review';
    if (status === 'approved') return 'status-approved';
    if (status === 'rejected') return 'status-rejected';
    return 'status-draft';
  },

  // 获取状态文本
  getStatusText(status) {
    if (!status || status === 'draft') return '草稿';
    if (status === 'submitted') return '已提交';
    if (status === 'under_review') return '审核中';
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '已拒绝';
    return '草稿';
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
      
      // 计算审批状态统计
      const approvalStats = this.calculateApprovalStats(result.submissions || []);
      
      this.setData({
        submittedUsers: result.submissions || [],
        pendingUsers: result.pending_users || [],
        filteredSubmittedUsers: result.submissions || [],
        filteredPendingUsers: result.pending_users || [],
        submittedCount: result.submitted_count || 0,
        pendingCount: result.pending_users ? result.pending_users.length : 0,
        totalUsers: result.total_users || 0,
        submissionRate,
        approvalStats
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

  // 计算审批状态统计数据
  calculateApprovalStats(submissions) {
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    
    submissions.forEach(item => {
      const status = item.submission.status;
      if (status === 'submitted' || status === 'under_review') {
        pendingCount++;
      } else if (status === 'approved') {
        approvedCount++;
      } else if (status === 'rejected') {
        rejectedCount++;
      }
    });
    
    return {
      pendingCount,
      approvedCount,
      rejectedCount
    };
  },

  // 生成分析数据 - 添加审批状态分析
  generateAnalyticsData() {
    // 提交率分析已在加载数据时完成
    // 审批状态分析已在loadTemplateData中完成
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

  // 显示审批模态框
  showApprovalModal(e) {
    const userId = e.currentTarget.dataset.userId;
    const fileId = e.currentTarget.dataset.fileId;
    const username = e.currentTarget.dataset.username;
    const filename = e.currentTarget.dataset.filename;
    
    this.setData({
      showApprovalModal: true,
      approvalDecision: '',
      approvalComment: '',
      currentApproval: {
        fileId,
        userId,
        username,
        filename
      }
    });
  },
  
  // 隐藏审批模态框
  hideApprovalModal() {
    this.setData({
      showApprovalModal: false
    });
  },
  
  // 选择审批决定
  selectApprovalDecision(e) {
    const decision = e.currentTarget.dataset.decision;
    this.setData({
      approvalDecision: decision
    });
  },
  
  // 处理审批意见输入
  onApprovalCommentInput(e) {
    this.setData({
      approvalComment: e.detail.value
    });
  },
  
  // 提交审批
  async submitApproval() {
    if (!this.data.approvalDecision) {
      wx.showToast({
        title: '请选择审批决定',
        icon: 'none'
      });
      return;
    }
    
    const { fileId, userId } = this.data.currentApproval;
    const { approvalDecision, approvalComment } = this.data;
    
    try {
      wx.showLoading({ title: '提交中...' });
      
      // 获取或创建审批记录
      const approvalData = await post(`/api/v1/files/${fileId}/approve`, {
        decision: approvalDecision,
        comments: approvalComment
      });
      
      if (approvalData.success) {
        wx.showToast({
          title: '审批提交成功',
          icon: 'success'
        });
        
        // 关闭模态框
        this.hideApprovalModal();
        
        // 重新加载数据
        await this.loadTemplateData(this.data.templateId);
      } else {
        throw new Error(approvalData.error || '审批提交失败');
      }
    } catch (err) {
      console.error('审批提交失败:', err);
      wx.showToast({
        title: err.message || '审批失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});