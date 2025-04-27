// pages/enforcer/inspection/detail.js
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
          // 处理时间格式
          if (res.data.inspection && res.data.inspection.planned_date) {
            res.data.inspection.planned_date = this.formatDateTime(res.data.inspection.planned_date);
          }
          if (res.data.inspection && res.data.inspection.completed_at) {
            res.data.inspection.completed_at = this.formatDateTime(res.data.inspection.completed_at);
          }
          
          // 处理执法人员信息
          if (res.data.inspection && !res.data.inspection.enforcer_name) {
            // 从本地存储获取当前用户名
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.username) {
              res.data.inspection.enforcer_name = userInfo.username;
            }
          }
          
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

  // 格式化日期时间
  formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    // 检查是否已包含时间部分
    if (dateTimeStr.includes(':')) {
      return dateTimeStr; // 已有时间格式，直接返回
    } else {
      // 只有日期，添加时间部分
      return `${dateTimeStr} 00:00`;
    }
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

  // 执行检查任务
  executeInspection() {
    wx.navigateTo({
      url: `/pages/enforcer/inspection/execute?id=${this.data.inspectionId}`
    });
  },

  // 导航至企业地址
  navigateToCompany() {
    const company = this.data.inspection.company;
    if (!company || !company.company_address) {
      wx.showToast({
        title: '企业地址不完整',
        icon: 'none'
      });
      return;
    }

    // 使用腾讯位置服务SDK转换地址为经纬度
    app.geocoder(company.company_address).then(res => {
      const location = res.location;
      wx.openLocation({
        latitude: location.lat,
        longitude: location.lng,
        name: company.company_name,
        address: company.company_address,
        scale: 18
      });
    }).catch(err => {
      console.error('地址解析失败:', err);
      wx.showToast({
        title: '导航失败，地址解析错误',
        icon: 'none'
      });
    });
  },

  // 联系企业
  contactCompany() {
    const company = this.data.inspection.company;
    if (!company || !company.contact_info) {
      wx.showToast({
        title: '联系方式不完整',
        icon: 'none'
      });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: company.contact_info,
      fail: (err) => {
        console.error('拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});