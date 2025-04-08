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
    markers: []
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
  async loadCompanyDetail() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/companies/${this.data.companyId}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          company: res.data
        })
        
        // 解析地址为地理坐标
        if (res.data.company_address) {
          this.geocodeAddress(res.data.company_address)
        }
      } else {
        wx.showToast({
          title: '获取企业信息失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载企业详情失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
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

  // 地址解析为坐标
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

  // 地图导航
  openLocation() {
    const { latitude, longitude } = this.data.mapLocation
    wx.openLocation({
      latitude,
      longitude,
      name: this.data.company.company_name,
      address: this.data.company.company_address,
      scale: 18
    })
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