// pages/admin/template/list.js
const app = getApp();
const requestModule = require('../../../utils/request');
const fileUtils = require('../../../utils/file');

// 正确导入模块中的delete方法，重命名为del（因为delete是关键字）
const { get, post, delete: del, upload } = requestModule;

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
    currentPage: 1,
    selectedIds: {}, // 用于存储已选中的模板ID
    selectedTemplates: [], // 存储已选中的模板对象
    selectAll: false, // 是否全选
    showBatchDelete: false, // 是否显示批量删除确认框
    isDeleting: false, // 是否正在删除
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
      
      // 重置选择状态
      this.setData({ 
        templates: templatesWithSubmissions,
        filteredTemplates: templatesWithSubmissions,
        hasMoreData: templatesWithSubmissions.length >= this.data.pageSize,
        selectedIds: {},
        selectedTemplates: [],
        selectAll: false
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
      // 更新选中状态以匹配新的过滤结果
      this.updateSelectedTemplates(this.data.selectedIds);
      return;
    }
    
    const filtered = templates.filter(template => 
      template.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchValue.toLowerCase()))
    );
    
    this.setData({
      filteredTemplates: filtered
    });
    
    // 更新选中状态以匹配新的过滤结果
    this.updateSelectedTemplates(this.data.selectedIds);
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
 // 删除模板 - 优化错误处理
deleteTemplate(e) {
  const id = e.currentTarget.dataset.id;
  const name = e.currentTarget.dataset.name;
  
  wx.showModal({
    title: '确认删除',
    content: `确定要删除模板"${name}"吗？此操作不可恢复，并且会影响所有已提交的文件。`,
    success: async (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '删除中...' });
        
        try {
          await del(`/api/v1/admin/templates/${id}`);
          
          // 更新选中状态
          if (this.data.selectedIds[id]) {
            const selectedIds = { ...this.data.selectedIds };
            delete selectedIds[id];
            this.updateSelectedTemplates(selectedIds);
          }
          
          wx.showToast({ title: '删除成功' });
          this.loadTemplates();
        } catch (err) {
          console.error('删除失败:', err);
          
          // 提取更有意义的错误信息
          let errorMessage = err.message || '删除失败';
          
          // 检查是否包含外键约束错误
          if (errorMessage.includes("IntegrityError") || 
              errorMessage.includes("cannot be null") ||
              errorMessage.includes("foreign key constraint")) {
            errorMessage = "该模板有关联的审批记录或提交文件，无法删除";
          }
          
          wx.showModal({
            title: '删除失败',
            content: errorMessage,
            showCancel: false
          });
        } finally {
          wx.hideLoading();
        }
      }
    }
  });
},
  
  // 切换选择模板
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const selectedIds = { ...this.data.selectedIds };
    
    if (selectedIds[id]) {
      delete selectedIds[id];
    } else {
      selectedIds[id] = true;
    }
    
    this.updateSelectedTemplates(selectedIds);
  },
  
  // 全选/取消全选
  toggleSelectAll() {
    if (this.data.selectAll) {
      // 当前是全选状态，改为取消全选
      this.updateSelectedTemplates({});
    } else {
      // 当前非全选状态，改为全选
      const selectedIds = {};
      this.data.filteredTemplates.forEach(template => {
        selectedIds[template.id] = true;
      });
      this.updateSelectedTemplates(selectedIds);
    }
  },
  
  // 更新已选择的模板
  updateSelectedTemplates(selectedIds) {
    const selectedTemplates = this.data.filteredTemplates.filter(
      template => selectedIds[template.id]
    );
    
    const selectAll = selectedTemplates.length > 0 && 
      selectedTemplates.length === this.data.filteredTemplates.length;
    
    this.setData({
      selectedIds,
      selectedTemplates,
      selectAll
    });
  },
  
  // 显示批量删除确认
  showBatchDeleteConfirm() {
    if (this.data.selectedTemplates.length === 0) {
      wx.showToast({
        title: '请先选择要删除的模板',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      showBatchDelete: true
    });
  },
  
  // 隐藏批量删除确认
  hideBatchDeleteModal() {
    this.setData({
      showBatchDelete: false
    });
  },
  
  // 执行批量删除
 // 执行批量删除 - 优化错误处理
async executeBatchDelete() {
  if (this.data.isDeleting) return;
  
  const selectedIds = Object.keys(this.data.selectedIds);
  if (selectedIds.length === 0) {
    this.hideBatchDeleteModal();
    return;
  }
  
  this.setData({ isDeleting: true });
  wx.showLoading({ title: '批量删除中...' });
  
  try {
    // 创建一个批量删除的Promise数组
    const deletePromises = selectedIds.map(id => 
      del(`/api/v1/admin/templates/${id}`)
        .catch(err => {
          // 提取更有意义的错误信息
          let errorMessage = err.message || '未知错误';
          
          // 检查是否包含外键约束错误
          if (errorMessage.includes("IntegrityError") || 
              errorMessage.includes("cannot be null") ||
              errorMessage.includes("foreign key constraint")) {
            errorMessage = "该模板可能有关联的审批记录或提交文件，无法删除";
          }
          
          console.error(`删除ID为${id}的模板失败:`, err);
          return { error: true, id, message: errorMessage };
        })
    );
    
    // 等待所有删除操作完成
    const results = await Promise.all(deletePromises);
    
    // 统计成功和失败的数量
    const failedResults = results.filter(r => r && r.error);
    const successCount = selectedIds.length - failedResults.length;
    
    // 清空选择
    this.updateSelectedTemplates({});
    
    // 重新加载模板列表，即使部分删除失败也刷新列表
    await this.loadTemplates();
    
    // 显示结果
    if (failedResults.length === 0) {
      wx.showToast({
        title: `成功删除${successCount}个模板`,
        icon: 'success',
        duration: 2000
      });
    } else {
      // 提供更详细的错误信息
      const errorMessages = [...new Set(failedResults.map(r => r.message))];
      
      wx.showModal({
        title: '删除结果',
        content: `成功: ${successCount}个, 失败: ${failedResults.length}个\n\n${errorMessages[0]}`,
        showCancel: false
      });
    }
  } catch (err) {
    console.error('批量删除失败:', err);
    
    // 提供更友好的错误提示
    let errorMessage = '批量删除失败';
    if (err.message && err.message.includes("IntegrityError")) {
      errorMessage = '删除失败：部分模板有关联数据无法删除';
    }
    
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    });
  } finally {
    this.setData({ isDeleting: false });
    this.hideBatchDeleteModal();
    wx.hideLoading();
  }
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