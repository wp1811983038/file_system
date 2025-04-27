// pages/admin/message/detail.js
const app = getApp();
const fileUtils = require('../../../utils/file');

Page({
  data: {
    messageId: null,
    message: {},
    loading: false
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

  onReady() {
    // 调试输出
    console.log('当前消息数据:', JSON.stringify(this.data.message));
    console.log('当前用户角色:', wx.getStorageSync('userRole'));
  },

  // 加载消息详情
  async loadMessageDetail(messageId) {
    try {
      this.setData({ loading: true });
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
      
      if (res.statusCode === 200) {
        // 设置导航栏标题
        let title = "消息详情";
        if (res.data.type === 'system') {
          title = "系统通知";
        } else if (res.data.type === 'file_receive') {
          title = "文件接收";
        } else if (res.data.type === 'file_process') {
          title = "审批结果";
        } else if (res.data.type === 'inspection_notice') {
          title = "执法检查";
        } else if (res.data.type === 'feedback') {
          title = "问题反馈";
        }
        wx.setNavigationBarTitle({ title });
        
        // 先设置基本消息数据
        this.setData({ message: res.data });
        
        // 如果是反馈类型，加载完整的反馈详情
        if (res.data.related_type === 'feedback' && res.data.related_id) {
          await this.loadFeedbackDetail(res.data.related_id);
        }
      } else {
        throw new Error('获取消息详情失败');
      }
    } catch (err) {
      console.error('加载消息详情失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // 加载反馈详情
  async loadFeedbackDetail(feedbackId) {
    try {
      const token = wx.getStorageSync('token');
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/feedback/${feedbackId}`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        console.log('获取到反馈详情:', res.data);
        
        // 处理图片数据
        let imageUrls = [];
        if (res.data.image_urls) {
          if (typeof res.data.image_urls === 'string') {
            if (res.data.image_urls.includes(',')) {
              imageUrls = res.data.image_urls.split(',').filter(url => url.trim());
            } else if (res.data.image_urls.trim()) {
              imageUrls = [res.data.image_urls];
            }
          } else if (Array.isArray(res.data.image_urls)) {
            imageUrls = res.data.image_urls;
          }
        }
        
        // 将完整的反馈信息设置到message的related_info中
        this.setData({
          'message.related_info': {
            ...res.data,
            image_urls: imageUrls
          }
        });
      } else {
        console.error('获取反馈详情失败:', res.data);
      }
    } catch (err) {
      console.error('加载反馈详情失败:', err);
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
      const userId = this.data.message.related_info.user_id; // 需要确保后端返回user_id
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

  // 查看执法检查详情
  viewInspectionDetail() {
    if (!this.data.message.related_info || !this.data.message.related_info.id) {
      wx.showToast({
        title: '检查任务信息不完整',
        icon: 'none'
      });
      return;
    }
    
    const inspectionId = this.data.message.related_info.id;
    wx.navigateTo({
      url: `/pages/enforcer/inspection/detail?id=${inspectionId}`
    });
  },
  
  // 预览执法检查图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.message.related_info.photos.map(photo => photo.photo_url);
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  // 预览反馈图片
  previewFeedbackImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.message.related_info?.image_urls || [];
    
    if (urls.length > 0) {
      wx.previewImage({
        current: url,
        urls: urls
      });
    }
  },

  // 查看和回复反馈
  viewFeedbackDetail() {
    // 使用related_id而不是related_info.id
    const feedbackId = this.data.message.related_id || 
                     (this.data.message.related_info ? this.data.message.related_info.id : null);
                     
    if (!feedbackId) {
      wx.showToast({
        title: '反馈信息不完整',
        icon: 'none'
      });
      return;
    }
    
    // 添加振动反馈
    wx.vibrateShort({ type: 'light' });
    
    // 简单回复功能 - 弹出回复对话框
    wx.showModal({
      title: '回复反馈',
      editable: true,
      placeholderText: '请输入回复内容...',
      success: (res) => {
        if (res.confirm && res.content) {
          this.submitFeedbackReply(feedbackId, res.content);
        }
      }
    });
  },
  
  // 提交反馈回复
  async submitFeedbackReply(feedbackId, comment) {
    try {
      wx.showLoading({ title: '提交中...' });
      
      const token = wx.getStorageSync('token');
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/feedback/${feedbackId}/reply`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            comment: comment,
            status: 'processing' // 设置为处理中状态
          },
          success: resolve,
          fail: reject
        });
      });
      
      wx.hideLoading();
      
      if (res.statusCode === 200) {
        wx.showToast({
          title: '回复成功',
          icon: 'success'
        });
        
        // 重新加载反馈详情
        this.loadFeedbackDetail(feedbackId);
      } else {
        throw new Error('回复提交失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('回复反馈失败:', err);
      wx.showToast({
        title: '回复失败',
        icon: 'none'
      });
    }
  },
  
  // 分享功能
  onShareAppMessage() {
    return {
      title: this.data.message.title || '消息详情',
      path: `/pages/admin/message/detail?id=${this.data.messageId}`
    };
  }
});