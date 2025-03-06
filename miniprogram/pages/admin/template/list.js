// pages/admin/template/list.js
const app = getApp();
// 使用CommonJS方式导入模块
const requestModule = require('../../../utils/request');
const FileUtils = require('../../../utils/file');

// 从模块中获取需要的方法
const get = requestModule.get;
const post = requestModule.post;
const del = requestModule.delete;
const upload = requestModule.upload;

// API 路径常量
const API_PATHS = {
  TEMPLATES: '/api/v1/admin/templates',
  CHECK_NAME: '/api/v1/admin/templates/check-name',
  TEMPLATE_STATUS: (id) => `/api/v1/files/templates/${id}/status`,
  DOWNLOAD_TEMPLATE: (id) => `/api/v1/files/download/template/${id}`,
  DOWNLOAD_SUBMISSION: (userId, templateId) => `/api/v1/files/download/submission/${userId}/${templateId}`,
  PREVIEW_SUBMISSION: (userId, templateId) => `/api/v1/files/preview/submission/${userId}/${templateId}`
};

Page({
  data: {
    templates: [],
    showUpload: false,
    showSubmissions: false,
    chosenFile: null,
    activeTab: 'submitted',
    submittedUsers: [],
    pendingUsers: [],
    submittedCount: 0,
    pendingCount: 0,
    currentTemplate: null,
    uploadProgress: 0,
    isLoading: false
  },

  onLoad(options) {
    this.loadTemplates();
  },

  onShow() {
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1  // 模板管理
      });
    }

    // 如果提交详情弹窗打开，刷新提交列表
    if (this.data.showSubmissions) {
      this.refreshSubmissionsList();
    }
  },

  onPullDownRefresh() {
    this.loadTemplates().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 网络恢复时调用
  onNetworkResume() {
    this.loadTemplates();
  },

  // 加载模板列表
  async loadTemplates() {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载中...' });
    
    try {
      const templates = await get(API_PATHS.TEMPLATES);
      this.setData({ templates });
      return templates;
    } catch (err) {
      console.error('加载模板列表失败:', err);
      wx.showToast({
        title: '加载失败，请稍后再试',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
      wx.hideLoading();
    }
  },

  showUploadModal() {
    this.setData({ showUpload: true });
  },

  hideUploadModal() {
    this.setData({
      showUpload: false,
      chosenFile: null,
      uploadProgress: 0
    });
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        // 检查文件大小限制 (如10MB)
        const file = res.tempFiles[0];
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        
        if (file.size > MAX_SIZE) {
          wx.showToast({
            title: '文件不能超过10MB',
            icon: 'none'
          });
          return;
        }
        
        this.setData({ chosenFile: file });
      }
    });
  },

  // 上传模板文件
  async handleUpload(e) {
    const formData = e.detail.value;
    const { chosenFile } = this.data;

    if (!chosenFile || !formData.name) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    try {
      // 检查模板名称是否可用
      const nameCheckResult = await post(API_PATHS.CHECK_NAME, { name: formData.name });
      
      if (!nameCheckResult.available) {
        wx.showToast({
          title: '模板名称已存在',
          icon: 'none'
        });
        return;
      }
      
      // 上传文件
      const result = await upload(
        API_PATHS.TEMPLATES, 
        chosenFile.path, 
        {
          name: formData.name,
          description: formData.description || ''
        },
        {
          onProgress: (res) => {
            this.setData({ uploadProgress: res.progress });
          }
        }
      );
      
      wx.showToast({ title: '上传成功' });
      this.loadTemplates();
      this.hideUploadModal();
    } catch (err) {
      console.error('上传失败:', err);
      wx.showToast({
        title: err.message || '上传失败',
        icon: 'none'
      });
    }
  },

  // 删除模板
  deleteTemplate(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个模板吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            await del(`${API_PATHS.TEMPLATES}/${id}`);
            wx.showToast({ title: '删除成功' });
            this.loadTemplates();
          } catch (err) {
            wx.showToast({
              title: err.message || '删除失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 查看提交状态
  async viewSubmissions(e) {
    const templateId = e.currentTarget.dataset.id;
    const templateName = e.currentTarget.dataset.name;

    wx.showLoading({ title: '加载中...' });

    try {
      const result = await get(API_PATHS.TEMPLATE_STATUS(templateId));

      this.setData({
        showSubmissions: true,
        currentTemplate: { id: templateId, name: templateName },
        submittedUsers: result.submissions || [],
        pendingUsers: result.pending_users || [],
        submittedCount: result.submitted_count || 0,
        pendingCount: result.pending_users?.length || 0,
        activeTab: 'submitted'
      });
    } catch (err) {
      console.error('获取提交详情失败:', err);
      wx.showToast({
        title: err.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  hideSubmissionsModal() {
    this.setData({ showSubmissions: false });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 下载模板
  async downloadTemplate(e) {
    const templateId = e.currentTarget.dataset.id;
    const templateName = e.currentTarget.dataset.name;
    
    // 构建完整URL
    const baseUrl = app.globalData.baseUrl;
    const downloadUrl = `${baseUrl}${API_PATHS.DOWNLOAD_TEMPLATE(templateId)}`;
    
    await FileUtils.downloadAndSaveFile(
      downloadUrl, 
      {
        fileName: templateName,
        preview: true
      }
    );
  },

  // 预览提交文件
  async viewSubmission(e) {
    const { userId, templateId, username, templateName } = e.currentTarget.dataset;
    
    // 构建完整URL
    const baseUrl = app.globalData.baseUrl;
    const previewUrl = `${baseUrl}${API_PATHS.PREVIEW_SUBMISSION(userId, templateId)}`;
    
    await FileUtils.downloadAndSaveFile(
      previewUrl, 
      {
        fileName: `${templateName}-${username}`,
        preview: true
      }
    );
  },

  // 下载提交文件
  async downloadSubmission(e) {
    const { userId, templateId, username, templateName } = e.currentTarget.dataset;
    
    // 构建完整URL
    const baseUrl = app.globalData.baseUrl;
    const downloadUrl = `${baseUrl}${API_PATHS.DOWNLOAD_SUBMISSION(userId, templateId)}`;
    
    await FileUtils.downloadAndSaveFile(
      downloadUrl, 
      {
        fileName: `${templateName}-${username}`,
        preview: true
      }
    );
  },

  // 刷新提交列表
  async refreshSubmissionsList() {
    if (!this.data.currentTemplate) return;

    const { id: templateId } = this.data.currentTemplate;

    try {
      const result = await get(API_PATHS.TEMPLATE_STATUS(templateId));
      
      this.setData({
        submittedUsers: result.submissions || [],
        pendingUsers: result.pending_users || [],
        submittedCount: result.submitted_count || 0,
        pendingCount: result.pending_users?.length || 0
      });
    } catch (err) {
      console.error('刷新提交列表失败:', err);
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '文件模板管理',
      path: '/pages/admin/template/list'
    };
  }
});