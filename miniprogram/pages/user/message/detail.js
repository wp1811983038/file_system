// pages/user/message/detail.js
const app = getApp();
const fileUtils = require('../../../utils/file');

Page({
  data: {
    messageId: null,
    message: {}
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ messageId: options.id });
      this.loadMessageDetail(options.id);
    } else {
      wx.showToast({
        title: '无效的消息ID',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载消息详情
  async loadMessageDetail(messageId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/messages/${messageId}`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      wx.hideLoading();
      
      if (res.statusCode === 200) {
        // 设置导航栏标题
        let title = "消息详情";
        if (res.data.type === 'system') {
          title = "系统通知";
        } else if (res.data.type === 'file_receive') {
          title = "文件接收";
        } else if (res.data.type === 'file_process') {
          title = "审批结果";
        }
        wx.setNavigationBarTitle({ title });
        
        this.setData({ message: res.data });
      } else {
        throw new Error('获取消息详情失败');
      }
    } catch (err) {
      console.error('加载消息详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 查看文件
  async viewFile() {
    if (!this.data.message.related_info || !this.data.message.related_info.id) {
      wx.showToast({
        title: '文件信息不完整',
        icon: 'none'
      });
      return;
    }
    
    try {
      const userId = app.globalData.userId || wx.getStorageSync('userId');
      const templateId = this.data.message.related_info.template_id;
      
      if (!userId || !templateId) {
        throw new Error('用户信息或模板信息不完整');
      }
      
      // 添加触感反馈
      wx.vibrateShort({ type: 'light' });
      
      wx.showLoading({ title: '加载中...' });
      
      // 构建文件预览URL
      const previewUrl = `${app.globalData.baseUrl}/api/v1/files/preview/submission/${userId}/${templateId}`;
      
      await fileUtils.downloadAndSaveFile(
        previewUrl,
        {
          fileName: this.data.message.related_info.filename,
          preview: true,
          skipPrompt: true
        }
      );
    } catch (err) {
      console.error('查看文件失败:', err);
      wx.showToast({
        title: '文件查看失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 下载模板
  async downloadTemplate() {
    if (!this.data.message.related_info || !this.data.message.related_info.id) {
      wx.showToast({
        title: '模板信息不完整',
        icon: 'none'
      });
      return;
    }
    
    try {
      const templateId = this.data.message.related_info.id;
      
      // 添加触感反馈
      wx.vibrateShort({ type: 'light' });
      
      wx.showLoading({ title: '准备下载...' });
      
      // 构建模板下载URL
      const downloadUrl = `${app.globalData.baseUrl}/api/v1/files/download/template/${templateId}`;
      
      await fileUtils.downloadAndSaveFile(
        downloadUrl,
        {
          fileName: this.data.message.related_info.name,
          preview: true
        }
      );
    } catch (err) {
      console.error('下载模板失败:', err);
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 提交文件
  submitFile() {
    if (!this.data.message.related_info || !this.data.message.related_info.id) {
      wx.showToast({
        title: '模板信息不完整',
        icon: 'none'
      });
      return;
    }
    
    const templateId = this.data.message.related_info.id;
    
    // 跳转到文件列表页面，并传递需要上传的模板ID
    wx.switchTab({
      url: '/pages/user/files/list',
      success: () => {
        // 向上一个页面传递数据，触发上传模态框
        const pages = getCurrentPages();
        const filesPage = pages[pages.length - 1];
        
        if (filesPage && filesPage.openUploadModal) {
          // 延迟执行，确保页面已完全加载
          setTimeout(() => {
            filesPage.openUploadModal({
              currentTarget: {
                dataset: {
                  templateId: templateId,
                  isResubmit: false
                }
              }
            });
          }, 500);
        }
      }
    });
    
    // 添加触感反馈
    wx.vibrateShort();
  }
});