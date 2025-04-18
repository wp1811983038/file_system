// pages/enforcer/inspection/detail.js 检查详情
const app = getApp();

Page({
  data: {
    inspection: null,
    isLoading: true,
    error: null
  },

  onLoad(options) {
    // 获取URL参数中的检查ID
    if (options.id) {
      this.setData({ inspectionId: options.id });
      this.loadInspectionDetail(options.id);
    } else {
      this.setData({ 
        isLoading: false,
        error: '未找到检查ID'
      });
    }
  },

  // 加载检查详情
  loadInspectionDetail(id) {
    wx.showLoading({ title: '加载中...' });
    
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/${id}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        console.log('检查详情数据:', res.data);
        if (res.statusCode === 200) {
          this.setData({
            inspection: res.data,
            isLoading: false
          });
        } else {
          this.setData({
            isLoading: false,
            error: '获取检查详情失败'
          });
        }
      },
      fail: (err) => {
        console.error('请求检查详情失败:', err);
        this.setData({
          isLoading: false,
          error: '请求失败，请检查网络连接'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const photos = this.data.inspection.photos || [];
    const urls = photos.map(photo => photo.photo_url);
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});