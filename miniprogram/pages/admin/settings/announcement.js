// pages/admin/settings/announcement.js
const app = getApp()

Page({
  data: {
    systemSettings: {
      system_name: '',
      system_description: ''
    },
    announcementLength: 0,
    errors: {},
    globalError: '',
    submitting: false,
    showSuccessTip: false,
    successMessage: ''
  },

  onLoad() {
    this.loadSettings()
  },

  onPullDownRefresh() {
    this.loadSettings().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载系统设置
  async loadSettings() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      wx.showLoading({ title: '加载中...' })
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/admin/settings`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()
      
      if (res.statusCode === 200) {
        this.setData({ 
          systemSettings: res.data,
          announcementLength: res.data.system_description ? res.data.system_description.length : 0
        })
      } else {
        throw new Error('获取系统设置失败')
      }
    } catch (err) {
      console.error('加载系统设置失败:', err)
      wx.showToast({
        title: '获取设置失败',
        icon: 'none'
      })
    }
  },

  // 监听公告内容输入，更新字数统计
  onAnnouncementInput(e) {
    const value = e.detail.value
    this.setData({
      announcementLength: value ? value.length : 0,
      'systemSettings.system_description': value
    })
  },

  // 表单验证
  validateAnnouncement(description) {
    const errors = {}
    
    if (description && description.length > 500) {
      errors.system_description = '系统公告不能超过500个字符'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 处理公告内容提交
  async handleAnnouncementSubmit(e) {
    try {
      // 先清除全局错误
      this.setData({ 
        globalError: '',
        errors: {}
      })
      
      const data = {
        system_name: this.data.systemSettings.system_name,  // 保留现有系统名称
        system_description: e.detail.value.system_description.trim()
      }
      
      // 表单验证
      if (!this.validateAnnouncement(data.system_description)) {
        return
      }

      this.setData({ submitting: true })
      wx.showLoading({ title: '保存中...' })
      
      const token = wx.getStorageSync('token')
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/admin/settings`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: data,
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()

      if (res.statusCode === 200) {
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        // 显示成功提示
        this.showSuccess('系统公告已更新')
        
        // 更新系统设置
        this.setData({
          'systemSettings.system_description': data.system_description
        })
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.data.error || '保存设置失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('保存公告内容失败:', err)
      
      this.setData({ 
        globalError: err.message || '网络请求失败，请重试',
        submitting: false
      })
      
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 显示成功提示
  showSuccess(message) {
    this.setData({
      showSuccessTip: true,
      successMessage: message
    })
    
    // 2秒后自动隐藏
    setTimeout(() => {
      this.setData({
        showSuccessTip: false
      })
    }, 2000)
  }
})