// pages/admin/settings/system-name.js
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
          systemSettings: res.data
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
  validateSystemName(name) {
    const errors = {}
    
    if (!name.trim()) {
      errors.system_name = '系统名称不能为空'
    } else if (name.length > 50) {
      errors.system_name = '系统名称不能超过50个字符'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 处理系统名称提交
  async handleSystemNameSubmit(e) {
    try {
      // 先清除全局错误
      this.setData({ 
        globalError: '',
        errors: {}
      })
      
      const data = {
        system_name: e.detail.value.system_name.trim(),
        system_description: this.data.systemSettings.system_description  // 保留现有公告内容
      }
      
      // 表单验证
      if (!this.validateSystemName(data.system_name)) {
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
        this.showSuccess('系统名称已更新')
        
        // 更新系统设置
        this.setData({
          'systemSettings.system_name': data.system_name
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
      console.error('保存系统名称失败:', err)
      
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