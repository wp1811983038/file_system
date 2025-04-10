// pages/enforcer/company/detail.js
const app = getApp()

Page({
  data: {
    companyId: null,
    company: {},
    inspectionHistory: [],
    files: [],
    mapLocation: {
      latitude: 34.746,
      longitude: 113.625
    },
    markers: [],
    defaultLocation: {
      latitude: 34.746,
      longitude: 113.625
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        companyId: options.id
      })
      this.loadCompanyDetail()
      this.loadInspectionHistory()
      this.loadCompanyFiles()
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 加载企业详细信息
  loadCompanyDetail() {
    wx.showLoading({ title: '加载中...' });
    
    const url = `${app.globalData.baseUrl}/api/v1/enforcer/companies/${this.data.companyId}`;
    console.log('请求URL:', url);
    console.log('公司ID:', this.data.companyId);
    
    wx.request({
      url: url,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        console.log('请求成功:', res);
        if (res.statusCode === 200) {
          this.setData({ company: res.data });
          if (res.data.company_address) {
            this.geocodeAddress(res.data.company_address);
          }
        } else {
          console.error('API错误:', res);
          wx.showToast({
            title: '获取企业信息失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('请求失败详情:', err);
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 加载检查历史
  async loadInspectionHistory() {
    try {
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections`,
        method: 'GET',
        data: {
          company_id: this.data.companyId
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          inspectionHistory: res.data.inspections || []
        })
      }
    } catch (err) {
      console.error('加载检查历史失败:', err)
    }
  },

  // 加载企业文件
  async loadCompanyFiles() {
    try {
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/companies/${this.data.companyId}/files`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        // 处理文件类型图标
        const files = res.data.files.map(file => {
          // 根据文件扩展名确定图标类型
          const extension = file.filename.split('.').pop().toLowerCase()
          let fileType = 'default'
          
          if (['doc', 'docx'].includes(extension)) fileType = 'word'
          else if (['xls', 'xlsx'].includes(extension)) fileType = 'excel'
          else if (['ppt', 'pptx'].includes(extension)) fileType = 'ppt'
          else if (['pdf'].includes(extension)) fileType = 'pdf'
          else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) fileType = 'image'
          
          return {
            ...file,
            file_type: fileType
          }
        })
        
        this.setData({ files })
      }
    } catch (err) {
      console.error('加载企业文件失败:', err)
    }
  },

  // 地址解析为坐标 - 修改版本，添加错误处理
  geocodeAddress(address) {
    app.geocoder(address).then(res => {
      const location = res.location
      
      this.setData({
        mapLocation: {
          latitude: location.lat,
          longitude: location.lng
        },
        markers: [{
          id: 1,
          latitude: location.lat,
          longitude: location.lng,
          title: this.data.company.company_name
        }]
      })
    }).catch(err => {
      console.error('地址解析失败:', err)
      // 地址解析失败时使用默认坐标
      this.setData({
        mapLocation: this.data.defaultLocation,
        markers: [{
          id: 1,
          latitude: this.data.defaultLocation.latitude,
          longitude: this.data.defaultLocation.longitude,
          title: this.data.company.company_name
        }]
      })
      
      // 可选：提示用户地址解析失败但可以使用默认位置
      wx.showToast({
        title: '定位失败，将使用默认位置',
        icon: 'none',
        duration: 2000
      })
    })
  },

  // 电话呼叫
  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone
      })
    }
  },

  // 地图导航 - 修改版本，兜底使用默认坐标
  openLocation() {
    // 检查mapLocation是否有效，否则使用默认坐标
    const location = this.data.mapLocation || this.data.defaultLocation
    
    wx.openLocation({
      latitude: location.latitude || location.lat,
      longitude: location.longitude || location.lng,
      name: this.data.company.company_name,
      address: this.data.company.company_address,
      scale: 18
    })
  },
  
  // 新增：点击地址直接导航
  navigateToAddress() {
    this.openLocation();
  },

  // 查看检查详情
  viewInspectionDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/enforcer/inspection/detail?id=${id}`
    })
  },

  // 预览文件
  previewFile(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/enforcer/file/detail?id=${id}`
    })
  },

  // 创建新检查
  createInspection() {
    wx.navigateTo({
      url: `/pages/enforcer/inspection/create?company_id=${this.data.companyId}`
    })
  }
})