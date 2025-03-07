const app = getApp();

Page({
  data: {
    fileId: null,
    fileInfo: {},
    approvalHistory: []
  },
  
  onLoad(options) {
    if (options.id) {
      this.setData({ fileId: options.id });
      this.loadApprovalProgress(options.id);
    }
  },
  
  async loadApprovalProgress(fileId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const token = wx.getStorageSync('token');
      
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/files/${fileId}/approval-progress`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        this.setData({
          fileInfo: res.data.file_info,
          approvalHistory: res.data.approval_history
        });
      } else {
        throw new Error(res.data.error || '获取审批进度失败');
      }
    } catch (err) {
      console.error('加载审批进度失败:', err);
      wx.showToast({
        title: err.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 重新提交文件
  resubmitFile() {
    const fileId = this.data.fileInfo.id;
    const templateId = this.data.fileInfo.template_id;
    
    if (!templateId) {
      wx.showToast({
        title: '无法获取模板ID',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到文件列表页面并传递参数
    wx.redirectTo({
      url: `/pages/user/files/list?resubmit=true&templateId=${templateId}&fileId=${fileId}`
    });
  }
});