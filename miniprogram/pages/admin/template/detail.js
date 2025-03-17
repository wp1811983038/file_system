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
    // 审批相关
    showApproval: false,
    currentApproval: {
      fileId: '',
      userName: '',
      status: '',
      comments: ''
    },
    approvalHistory: null,
    // 批量审批相关
    showBatchApproval: false,
    selectedFiles: [],
    // 审批状态统计
    approvedCount: 0,
    rejectedCount: 0,
    pendingApprovalCount: 0
  },

  onLoad(options) {
    console.log('页面加载，参数:', options);

    if (options.id) {
      this.setData({
        templateId: options.id,
        templateName: decodeURIComponent(options.name || '')
      });

      // 加载模板数据
      this.loadTemplateData(options.id);
    } else {
      console.error('缺少必要的templateId参数');
    }
  },

  // 修改onShow函数，避免在审批操作后立即自动刷新
  onShow() {
    // 可能在返回页面时需要刷新数据
    if (this.data.templateId && !this.data._justApproved) {
      console.log('页面显示，刷新数据 templateId:', this.data.templateId);
      this.loadTemplateData(this.data.templateId);
    }

    // 重置标志
    if (this.data._justApproved) {
      this.setData({ _justApproved: false });
    }
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
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
    console.log('切换标签为:', tab);
    this.setData({ activeTab: tab });

    // 如果是切换到分析标签，需要生成分析数据
    if (tab === 'analytics') {
      this.generateAnalyticsData();
    }
  },

  // 加载模板数据
  // 修复加载模板数据函数
  // 优化模板数据加载函数，确保使用正确的缓存控制
  async loadTemplateData(templateId) {
    console.log('开始加载模板数据, templateId:', templateId);
    wx.showLoading({ title: '加载中...' });

    try {
      if (!templateId) {
        throw new Error('模板ID不能为空');
      }

      // 生成时间戳和随机数防止浏览器和小程序缓存
      const timestamp = new Date().getTime();
      const randomNum = Math.floor(Math.random() * 1000000);

      // 获取模板提交状态数据
      const result = await get(`/api/v1/files/templates/${templateId}/status?t=${timestamp}&r=${randomNum}`);
      console.log('获取到的模板数据:', result);

      // 验证返回的数据结构
      if (!result || typeof result !== 'object') {
        throw new Error('获取模板数据失败：返回数据格式不正确');
      }

      // 防御性编程：确保所有必要的数据都存在，提供默认值
      const submittedCount = result.submitted_count || 0;
      const totalUsers = result.total_users || 0;

      // 计算提交率
      const submissionRate = totalUsers > 0
        ? Math.round((submittedCount / totalUsers) * 100)
        : 0;

      // 统计审批状态数量
      let approvedCount = 0;
      let rejectedCount = 0;
      let pendingApprovalCount = 0;

      // 处理和规范化提交数据
      let submissionsWithStatus = [];

      if (Array.isArray(result.submissions)) {
        submissionsWithStatus = result.submissions.map(submission => {
          // 防御性编程：确保每个submission对象都有正确的结构
          const processedSubmission = { ...submission };

          // 如果submission没有submission属性或该属性为null，则创建一个默认值
          if (!processedSubmission.submission || typeof processedSubmission.submission !== 'object') {
            processedSubmission.submission = {
              id: processedSubmission.submission_id || processedSubmission.id || null,
              status: 'pending',
              upload_date: processedSubmission.upload_date || new Date().toISOString().split('T')[0] + ' 00:00:00'
            };
          }

          // 确保username字段存在
          if (!processedSubmission.username && processedSubmission.user) {
            processedSubmission.username = processedSubmission.user.username || '未知用户';
          }

          // 确保user_id字段存在
          if (!processedSubmission.user_id && processedSubmission.user) {
            processedSubmission.user_id = processedSubmission.user.id;
          }

          // 如果连user对象都不存在，则创建一个用户id字段
          if (!processedSubmission.user_id && !processedSubmission.user) {
            processedSubmission.user_id = processedSubmission.id || 0;
          }

          // 分析审批状态
          const status = (processedSubmission.submission.status || 'pending').toLowerCase();
          if (status === 'approved') {
            approvedCount++;
          } else if (status === 'rejected') {
            rejectedCount++;
          } else {
            pendingApprovalCount++;
          }

          return processedSubmission;
        });
      } else {
        console.warn('警告：submissions不是数组', result.submissions);
      }

      // 创建安全的pendingUsers数组
      const pendingUsers = Array.isArray(result.pending_users) ? result.pending_users : [];

      // 更新页面数据
      this.setData({
        submittedUsers: submissionsWithStatus,
        pendingUsers: pendingUsers,
        filteredSubmittedUsers: submissionsWithStatus,
        filteredPendingUsers: pendingUsers,
        submittedCount: submittedCount,
        pendingCount: pendingUsers.length,
        totalUsers: totalUsers,
        submissionRate,
        approvedCount,
        rejectedCount,
        pendingApprovalCount
      }, () => {
        console.log('页面数据更新完成，当前approvedCount:', this.data.approvedCount);
        console.log('页面数据更新完成，当前rejectedCount:', this.data.rejectedCount);
        console.log('页面数据更新完成，当前pendingApprovalCount:', this.data.pendingApprovalCount);
      });

      // 如果当前标签是分析标签，生成分析数据
      if (this.data.activeTab === 'analytics') {
        this.generateAnalyticsData();
      }

      return result;
    } catch (err) {
      console.error('加载模板数据失败:', err);
      wx.showToast({
        title: '加载失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 生成分析数据 - 简化版，只关注提交率
  generateAnalyticsData() {
    console.log('生成分析数据');
  },

  // 搜索已提交用户
  onSearchSubmitted(e) {
    const keyword = e.detail.value.toLowerCase();
    console.log('搜索提交用户，关键字:', keyword);

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
    console.log('搜索未提交用户，关键字:', keyword);

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
    console.log('返回上一页');
    wx.navigateBack();
  },


  // 下载模板
  async downloadTemplate() {
    console.log('点击下载模板, templateId:', this.data.templateId);

    try {
      wx.showLoading({ title: '准备下载...' });

      // 构建下载URL
      const downloadUrl = `${app.globalData.baseUrl}/api/v1/files/download/template/${this.data.templateId}`;
      console.log('下载URL:', downloadUrl);

      await fileUtils.downloadAndSaveFile(
        downloadUrl,
        {
          fileName: this.data.templateName,
          preview: true
        }
      );
    } catch (err) {
      console.error('下载失败:', err);
      wx.showToast({
        title: '下载失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 预览提交文件
  async previewSubmission(e) {
    const userId = e.currentTarget.dataset.userId;
    console.log('点击预览提交文件, userId:', userId, 'templateId:', this.data.templateId);

    const user = this.data.submittedUsers.find(u => u.user_id === userId);

    if (!user) {
      console.error('找不到指定用户:', userId);
      wx.showToast({
        title: '找不到用户信息',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '加载中...' });

      // 构建预览URL
      const previewUrl = `${app.globalData.baseUrl}/api/v1/files/preview/submission/${userId}/${this.data.templateId}`;
      console.log('预览URL:', previewUrl);

      await fileUtils.downloadAndSaveFile(
        previewUrl,
        {
          fileName: `${this.data.templateName}-${user.username}`,
          preview: true
        }
      );
    } catch (err) {
      console.error('预览失败:', err);
      wx.showToast({
        title: '预览失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 下载提交文件
  async downloadSubmission(e) {
    const userId = e.currentTarget.dataset.userId;
    console.log('点击下载提交文件, userId:', userId, 'templateId:', this.data.templateId);

    const user = this.data.submittedUsers.find(u => u.user_id === userId);

    if (!user) {
      console.error('找不到指定用户:', userId);
      wx.showToast({
        title: '找不到用户信息',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '准备下载...' });

      // 构建下载URL
      const downloadUrl = `${app.globalData.baseUrl}/api/v1/files/download/submission/${userId}/${this.data.templateId}`;
      console.log('下载URL:', downloadUrl);

      await fileUtils.downloadAndSaveFile(
        downloadUrl,
        {
          fileName: `${this.data.templateName}-${user.username}`,
          preview: true
        }
      );
    } catch (err) {
      console.error('下载失败:', err);
      wx.showToast({
        title: '下载失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 显示审批模态框
  // 修改 showApprovalModal 函数以正确获取当前状态
  async showApprovalModal(e) {
    const fileId = e.currentTarget.dataset.fileId;
    const userName = e.currentTarget.dataset.userName;
    const status = e.currentTarget.dataset.status || 'pending';

    console.log('点击审批按钮, fileId:', fileId, 'userName:', userName, 'status:', status);

    if (!fileId) {
      console.error('审批失败：缺少文件ID');
      wx.showToast({
        title: '审批失败：缺少文件ID',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '加载审批信息...' });

    try {
      // 获取审批记录
      const approvalUrl = `${app.globalData.baseUrl}/api/v1/files/submissions/approval/${fileId}`;
      console.log('获取审批信息URL:', approvalUrl);

      const result = await get(`/api/v1/files/submissions/approval/${fileId}`);
      console.log('获取审批记录结果:', result);

      // 确保使用服务器返回的最新状态
      const currentStatus = result.submission_status || status;

      this.setData({
        showApproval: true,
        currentApproval: {
          fileId: fileId,
          userName: userName,
          status: currentStatus,
          comments: ''
        },
        approvalHistory: result.has_approval ? result.approval : null
      });

      // 如果已有审批记录，填充评论信息
      if (result.has_approval) {
        this.setData({
          'currentApproval.comments': result.approval.comments || ''
        });
      }

    } catch (err) {
      console.error('获取审批信息失败:', err);
      wx.showToast({
        title: '获取审批信息失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 隐藏审批模态框
  hideApprovalModal() {
    console.log('关闭审批模态框');
    this.setData({
      showApproval: false,
      currentApproval: {
        fileId: '',
        userName: '',
        status: '',
        comments: ''
      },
      approvalHistory: null
    });
  },

  // 处理批准操作
  async handleApprove() {
    console.log('点击批准按钮');
    this._submitApproval('approved');
  },

  // 处理拒绝操作
  async handleReject() {
    console.log('点击拒绝按钮');
    this._submitApproval('rejected');
  },


  onCommentsInput(e) {
    this.setData({
      'currentApproval.comments': e.detail.value
    });
    console.log('审批意见已更新:', e.detail.value); // 添加日志便于调试
  },
  // 提交审批

  // 修改后的审批提交函数 - 立即更新按钮状态
  async _submitApproval(status) {
    const { fileId, comments } = this.data.currentApproval;

    console.log('提交审批:', { fileId, status, comments }); // 打印日志检查数据

    if (!fileId) {
      console.error('提交审批失败：缺少文件ID');
      wx.showToast({
        title: '文件ID无效',
        icon: 'none'
      });
      return;
    }

    console.log('提交审批:', { fileId, status, comments });

    wx.showLoading({ title: '提交审批...' });

    try {
      // 构建审批URL
      const approveUrl = `${app.globalData.baseUrl}/api/v1/files/submissions/approve/${fileId}`;
      console.log('审批URL:', approveUrl);

      const result = await post(`/api/v1/files/submissions/approve/${fileId}`, {
        status: status,
        comments: comments
      });

      console.log('审批结果:', result);

      wx.hideLoading();

      // 审批成功后更新当前状态显示
      this.setData({
        'currentApproval.status': status
      });

      // 立即更新按钮状态 - 重要！
      const { submittedUsers, filteredSubmittedUsers } = this.data;
      const updatedSubmittedUsers = submittedUsers.map(user => {
        if (user.submission && user.submission.id === fileId) {
          // 创建一个新对象，避免直接修改原对象
          return {
            ...user,
            submission: {
              ...user.submission,
              status: status
            }
          };
        }
        return user;
      });

      // 同样更新过滤后的列表
      const updatedFilteredUsers = filteredSubmittedUsers.map(user => {
        if (user.submission && user.submission.id === fileId) {
          return {
            ...user,
            submission: {
              ...user.submission,
              status: status
            }
          };
        }
        return user;
      });

      // 更新审批统计
      let { approvedCount, rejectedCount, pendingApprovalCount } = this.data;

      // 如果之前是待审批状态，则减少待审批计数
      if (this.data.currentApproval.status === 'pending') {
        pendingApprovalCount = Math.max(0, pendingApprovalCount - 1);
      }
      // 如果之前是已批准状态，现在是拒绝，则减少已批准计数
      else if (this.data.currentApproval.status === 'approved' && status === 'rejected') {
        approvedCount = Math.max(0, approvedCount - 1);
      }
      // 如果之前是已拒绝状态，现在是批准，则减少已拒绝计数
      else if (this.data.currentApproval.status === 'rejected' && status === 'approved') {
        rejectedCount = Math.max(0, rejectedCount - 1);
      }

      // 增加对应状态的计数
      if (status === 'approved') {
        approvedCount++;
      } else if (status === 'rejected') {
        rejectedCount++;
      }

      // 立即更新页面数据，这样按钮状态会立即改变
      this.setData({
        submittedUsers: updatedSubmittedUsers,
        filteredSubmittedUsers: updatedFilteredUsers,
        approvedCount,
        rejectedCount,
        pendingApprovalCount,
        _justApproved: true  // 设置标记，避免onShow中重复刷新
      });

      // 隐藏模态框前为当前操作创建一个新的审批历史记录
      const currentDate = new Date();
      const formattedDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')} ${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')}`;

      const adminInfo = wx.getStorageSync('adminInfo') || { username: 'admin' };

      // 设置新的审批历史
      this.setData({
        approvalHistory: {
          approval_date: formattedDate,
          approver_name: adminInfo.username,
          status: status,
          comments: comments || '无审批意见'
        }
      });

      wx.showToast({
        title: '审批成功',
        icon: 'success',
        duration: 1500
      });

      // 延时隐藏模态框
      setTimeout(() => {
        this.hideApprovalModal();

        // 在后台重新从服务器获取最新状态，确保与服务器同步
        setTimeout(() => {
          this.loadTemplateData(this.data.templateId);
        }, 1000);
      }, 1500);

    } catch (err) {
      console.error('审批失败:', err);
      wx.showToast({
        title: err.message || '审批失败',
        icon: 'none'
      });
      wx.hideLoading();
    }
  },

  // 处理批量审批模态框显示
  showBatchApprovalModal() {
    console.log('点击批量审批按钮');

    // 目前仅支持待审批列表的选择
    const pendingSubmissions = this.data.submittedUsers.filter(
      user => user.submission && user.submission.status === 'pending'
    );

    if (pendingSubmissions.length === 0) {
      wx.showToast({
        title: '没有待审批的文件',
        icon: 'none'
      });
      return;
    }

    // 提取文件ID
    const fileIds = pendingSubmissions.map(user => user.submission.id);
    console.log('待批量审批的文件:', fileIds);

    this.setData({
      showBatchApproval: true,
      selectedFiles: fileIds
    });
  },

  // 隐藏批量审批模态框
  hideBatchApprovalModal() {
    console.log('关闭批量审批模态框');
    this.setData({
      showBatchApproval: false,
      selectedFiles: []
    });
  },

  // 处理批量批准
  async handleBatchApprove(e) {
    console.log('点击批量批准按钮');
    const formData = e.detail.value || {};
    this._submitBatchApproval('approved', formData.comments || '');
  },

  // 处理批量拒绝
  async handleBatchReject(e) {
    console.log('点击批量拒绝按钮');
    const formData = e.detail.value || {};
    this._submitBatchApproval('rejected', formData.comments || '');
  },

  // 提交批量审批
  // 修改批量审批函数
  async _submitBatchApproval(status, comments) {
    const { selectedFiles } = this.data;

    if (!selectedFiles.length) {
      console.error('批量审批失败：未选择文件');
      wx.showToast({
        title: '未选择任何文件',
        icon: 'none'
      });
      return;
    }

    console.log('批量审批:', { selectedFiles, status, comments });

    wx.showLoading({ title: '批量审批中...' });

    try {
      // 构建批量审批URL
      const batchApproveUrl = `${app.globalData.baseUrl}/api/v1/files/submissions/approve/batch`;
      console.log('批量审批URL:', batchApproveUrl);

      const result = await post('/api/v1/files/submissions/approve/batch', {
        file_ids: selectedFiles,
        status: status,
        comments: comments
      });

      console.log('批量审批结果:', result);

      wx.hideLoading();

      // 先隐藏模态框
      this.hideBatchApprovalModal();

      wx.showToast({
        title: `批量${status === 'approved' ? '批准' : '拒绝'}成功`,
        icon: 'success',
        duration: 2000
      });

      // 添加延时确保服务器处理完成，然后重新加载数据
      setTimeout(() => {
        // 重新从服务器获取最新状态
        this.loadTemplateData(this.data.templateId);
      }, 1500);

    } catch (err) {
      console.error('批量审批失败:', err);
      wx.showToast({
        title: err.message || '批量审批失败',
        icon: 'none'
      });
      wx.hideLoading();
    }
  }
});