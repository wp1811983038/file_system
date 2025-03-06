// pages/user/profile/edit.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    errors: {},
    submitting: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/profile`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      console.log('用户信息响应:', res)
      
      if (res.statusCode === 200) {
        this.setData({ userInfo: res.data })
      } else {
        throw new Error('获取用户信息失败')
      }
    } catch (err) {
      console.error('加载用户信息失败:', err)
      wx.showToast({
        title: '获取信息失败',
        icon: 'none'
      })
    }
  },

  // 表单验证
  validateProfile(data) {
    const errors = {}
    
    if (!data.username.trim()) {
      errors.username = '用户名不能为空'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 处理个人信息提交
  async handleProfileSubmit(e) {
    const data = e.detail.value
    
    // 验证表单
    if (!this.validateProfile(data)) {
      return
    }

    this.setData({ submitting: true })

    try {
      wx.showLoading({ title: '保存中...' })
      const token = wx.getStorageSync('token')
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/profile`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            username: data.username.trim(),
            company_name: data.company_name.trim(),
            contact_info: data.contact_info.trim()
          },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200) {
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(res.data.error || '保存失败')
      }
    } catch (err) {
      console.error('更新个人信息失败:', err)
      wx.showToast({
        title: err.message || '保存失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
      this.setData({ submitting: false })
    }
  }
})