// pages/user/feedback/detail.js
const app = getApp();

Page({
  data: {
    feedbackId: null,
    feedback: {},
    statusText: {
      'pending': '待处理',
      'processing': '处理中',
      'resolved': '已解决'
    },
    isLoading: true
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({
        feedbackId: options.id
      });
      
      this.loadFeedbackDetail(options.id);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  // 加载反馈详情
  loadFeedbackDetail: function(id) {
    const token = wx.getStorageSync('token');
    
    wx.showLoading({ title: '加载中' });
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/feedback/${id}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 确保图片URL为数组
          if (res.data.image_urls && typeof res.data.image_urls === 'string') {
            try {
              res.data.image_urls = JSON.parse(res.data.image_urls);
            } catch (e) {
              // 如果是逗号分隔的字符串，转换为数组
              if (res.data.image_urls.includes(',')) {
                res.data.image_urls = res.data.image_urls.split(',');
              } else {
                res.data.image_urls = [res.data.image_urls];
              }
            }
          }
          
          this.setData({
            feedback: res.data,
            isLoading: false
          });
        } else {
          wx.showToast({
            title: res.data.error || '加载失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },
  
  // 预览图片
  previewImage: function(e) {
    const url = e.currentTarget.dataset.url;
    const { feedback } = this.data;
    
    wx.previewImage({
      current: url,
      urls: feedback.image_urls
    });
  },
  
  // 分享
  onShareAppMessage: function() {
    const { feedback } = this.data;
    return {
      title: `反馈: ${feedback.type}`,
      path: `/pages/user/feedback/detail?id=${feedback.id}`
    };
  }
});