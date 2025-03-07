// pages/admin/template/list.js
const app = getApp();
const requestModule = require('../../../utils/request');
const fileUtils = require('../../../utils/file');

// 从模块中获取需要的方法
const { get, post, del, upload } = requestModule;

Page({
  data: {
    templates: [],
    filteredTemplates: [],
    searchValue: '',
    showUpload: false,
    chosenFile: null,
    uploadProgress: 0,
    isLoading: false,
    hasMoreData: false,
    pageSize: 10,
    currentPage: 1
  },

  onLoad() {
    this.loadTemplates();
  },

  onShow() {
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1  // 模板管理
      });
    }
  },

  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      hasMoreData: false
    }, () => {
      this.loadTemplates().then(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 加载模板列表
  async loadTemplates() {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载中...' });
    
    try {
      const templates = await get('/api/v1/admin/templates');
      
      // 添加随机生成的提交数据（真实环境应从API获取）
      const templatesWithSubmissions = templates.map(template => ({
        ...template,
        submitted_count: template.submitted_count || 0,
        total_users: template.total_users || 0
      }));
      
      this.setData({ 
        templates: templatesWithSubmissions,
        filteredTemplates: templatesWithSubmissions,
        hasMoreData: templatesWithSubmissions.length >= this.data.pageSize
      });
      
      return templatesWithSubmissions;
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

  // 阻止事件冒泡
  stopPropagation(e) {
    return;
  },

  // 防止模态框背景滚动
  preventTouchMove() {
    return false;
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });
    
    if (!e.detail.value) {
      this.setData({
        filteredTemplates: this.data.templates
      });
    }
  },

  // 执行搜索
  handleSearch() {
    const { searchValue, templates } = this.data;
    
    if (!searchValue.trim()) {
      this.setData({
        filteredTemplates: templates
      });
      return;
    }
    
    const filtered = templates.filter(template => 
      template.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchValue.toLowerCase()))
    );
    
    this.setData({
      filteredTemplates: filtered
    });
  },

  // 打开上传模态框
  showUploadModal() {
    this.setData({ 
      showUpload: true,
      chosenFile: null,
      uploadProgress: 0
    });
  },

  // 关闭上传模态框
  hideUploadModal() {
    this.setData({
      showUpload: false,
      chosenFile: null,
      uploadProgress: 0
    });
  },

  // 选择文件
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        // 检查文件大小限制
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
      // 检查模板名称是否已存在
      const nameCheckResult = await post('/api/v1/admin/templates/check-name', { 
        name: formData.name 
      });
      
      if (nameCheckResult && !nameCheckResult.available) {
        wx.showToast({
          title: '模板名称已存在',
          icon: 'none'
        });
        return;
      }
      
      // 上传文件
      await upload(
        '/api/v1/admin/templates', 
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
      content: '确定要删除这个模板吗？此操作不可恢复，并且会影响所有已提交的文件。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          try {
            await del(`/api/v1/admin/templates/${id}`);
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

  // 下载模板
  async downloadTemplate(e) {
    const { id, name } = e.currentTarget.dataset;
    
    try {
      wx.showLoading({ title: '准备下载...' });
      
      await fileUtils.downloadAndSaveFile(
        `${app.globalData.baseUrl}/api/v1/files/download/template/${id}`, 
        {
          fileName: name,
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

  // 加载更多数据
  loadMoreData() {
    if (this.data.isLoading || !this.data.hasMoreData) return;
    
    this.setData({
      currentPage: this.data.currentPage + 1,
      isLoading: true
    });
    
    // 实际项目中应当请求下一页数据
    // 此处为示例，省略实际API调用
    
    // 模拟API请求
    wx.showLoading({ title: '加载中...' });
    
    setTimeout(() => {
      this.setData({
        hasMoreData: false,
        isLoading: false
      });
      wx.hideLoading();
    }, 1000);
  },

  // 查看提交详情
  viewSubmissionDetails(e) {
    const { id, name } = e.currentTarget.dataset;
    
    wx.navigateTo({
      url: `/pages/admin/template/detail?id=${id}&name=${encodeURIComponent(name)}`
    });
  }
});