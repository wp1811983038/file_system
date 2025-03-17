// pages/admin/settings/index.js
const app = getApp()

Page({
  data: {
    systemSettings: {
      system_name: '',
      system_description: ''
    },
    errors: {},
    globalError: '',
    submitting: false,
    showSuccessTip: false,
    successMessage: '',
    systemAnnouncementLength: 0
  },

  onLoad() {
    this.loadSettings()
  },

  onShow() {
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3  // 设置
      })
    }
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
      console.log('系统设置响应:', res)
      
      if (res.statusCode === 200) {
        this.setData({ 
          systemSettings: res.data,
          systemAnnouncementLength: res.data.system_description ? res.data.system_description.length : 0
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

  // 表单验证
  validateSettings(data) {
    const errors = {}
    
    if (!data.system_name.trim()) {
      errors.system_name = '系统名称不能为空'
    } else if (data.system_name.length > 50) {
      errors.system_name = '系统名称不能超过50个字符'
    }
    
    if (data.system_description && data.system_description.length > 500) {
      errors.system_description = '系统公告不能超过500个字符'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 监听公告内容输入，更新字数统计
  onAnnouncementInput(e) {
    const value = e.detail.value
    this.setData({
      systemAnnouncementLength: value ? value.length : 0,
      'systemSettings.system_description': value
    })
  },

  // 处理设置提交
  async handleSettingsSubmit(e) {
    try {
      // 先清除全局错误
      this.setData({ globalError: '' })
      
      const data = e.detail.value
      console.log('提交的设置数据:', data)
      
      // 表单验证
      if (!this.validateSettings(data)) {
        console.log('表单验证失败:', this.data.errors)
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
          data: {
            system_name: data.system_name.trim(),
            system_description: data.system_description.trim()
          },
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()
      console.log('保存设置响应:', res)

      if (res.statusCode === 200) {
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        // 显示成功提示
        this.showSuccess('设置保存成功')
        
        // 重新加载设置
        await this.loadSettings()
      } else {
        throw new Error(res.data.error || '保存设置失败')
      }
    } catch (err) {
      wx.hideLoading()
      console.error('保存设置失败:', err)
      
      this.setData({ 
        globalError: err.message || '网络请求失败，请重试' 
      })
      
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 处理退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除存储的登录信息
          wx.clearStorageSync()
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login',
          })
        }
      }
    })
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