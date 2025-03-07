const app = getApp();
const fileUtils = require('../../utils/file');

Page({
  data: {
    approvalId: null,
    fileInfo: {},
    decision: '', // 'approved' 或 'rejected'
    comments: ''
  },
  
  onLoad(options) {
    if (options.id) {
      this.setData({ approvalId: options.id });
      this.loadApprovalDetail(options.id);
    }
  },
  
  async loadApprovalDetail(approvalId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      const token = wx.getStorageSync('token');
      
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/approvals/detail/${approvalId}`,
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
          fileInfo: res.data
        });
      } else {
        throw new Error(res.data.error || '获取审批详情失败');
      }
    } catch (err) {
      console.error('加载审批详情失败:', err);
      wx.showToast({
        title: err.message || '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 选择审批决定
  selectDecision(e) {
    const decision = e.currentTarget.dataset.value;
    this.setData({ decision });
  },
  
  // 处理意见输入
  onCommentsInput(e) {
    this.setData({ comments: e.detail.value });
  },
  
  // 预览文件
  async previewFile() {
    try {
      if (!this.data.fileInfo.file_id) {
        wx.showToast({
          title: '无法获取文件信息',
          icon: 'none'
        });
        return;
      }
      
      wx.showLoading({ title: '加载中...' });
      
      await fileUtils.downloadAndSaveFile(
        `${app.globalData.baseUrl}/api/v1/files/preview/submission/${this.data.fileInfo.submitter.id}/${this.data.fileInfo.file_id}`, 
        {
          fileName: this.data.fileInfo.filename,
          preview: true
        }
      );
    } catch (err) {
      console.error('预览文件失败:', err);
      wx.showToast({
        title: '预览失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 提交审批
  async submitApproval() {
    try {
      if (!this.data.decision) {
        wx.showToast({
          title: '请选择审批决定',
          icon: 'none'
        });
        return;
      }
      
      wx.showLoading({ title: '提交中...' });
      
      const token = wx.getStorageSync('token');
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/approvals/${this.data.approvalId}`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            decision: this.data.decision,
            comments: this.data.comments
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        wx.showToast({
          title: '审批已提交',
          icon: 'success'
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(res.data.error || '提交审批失败');
      }
    } catch (err) {
      console.error('提交审批失败:', err);
      wx.showToast({
        title: err.message || '提交失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});