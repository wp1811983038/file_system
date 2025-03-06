// pages/user/password/list.js
// pages/user/password/index.js
const app = getApp()

Page({
  data: {
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
    errors: {},
    changingPassword: false
  },

  onLoad() {
    // 页面加载时的逻辑
  },

  // 表单验证
  validatePassword(data) {
    const errors = {}
    
    if (!data.old_password) {
      errors.old_password = '当前密码不能为空'
    }
    
    if (!data.new_password) {
      errors.new_password = '新密码不能为空'
    } else if (data.new_password.length < 6) {
      errors.new_password = '新密码长度不能少于6位'
    }
    
    if (data.new_password !== data.confirm_password) {
      errors.confirm_password = '两次密码输入不一致'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  // 处理密码修改提交
  async handlePasswordSubmit(e) {
    const data = e.detail.value
    
    // 验证表单
    if (!this.validatePassword(data)) {
      return
    }

    this.setData({ changingPassword: true })

    try {
      wx.showLoading({ title: '提交中...' })
      const token = wx.getStorageSync('token')
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/change-password`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          data: {
            old_password: data.old_password,
            new_password: data.new_password
          },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200) {
        wx.hideLoading()
        
        // 添加轻微振动反馈
        wx.vibrateShort({ type: 'medium' })
        
        // 显示成功提示
        wx.showToast({
          title: '密码修改成功',
          icon: 'success',
          duration: 2000
        })
        
        // 修改密码成功后，延迟 1.5 秒返回登录页
        setTimeout(() => {
          wx.clearStorageSync()  // 清除本地存储
          wx.reLaunch({
            url: '/pages/login/login'
          })
        }, 1500)
      } else {
        throw new Error(res.data.error || '修改失败')
      }
    } catch (err) {
      console.error('修改密码失败:', err)
      
      // 设置具体的错误信息
      if (err.message && err.message.includes('Invalid password')) {
        this.setData({
          errors: {
            old_password: '当前密码不正确'
          }
        })
      } else {
        wx.showToast({
          title: err.message || '修改失败',
          icon: 'none'
        })
      }
    } finally {
      wx.hideLoading()
      this.setData({ changingPassword: false })
    }
  },

  // 切换密码显示状态
  toggleOldPassword() {
    this.setData({
      showOldPassword: !this.data.showOldPassword
    })
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' })
  },

  toggleNewPassword() {
    this.setData({
      showNewPassword: !this.data.showNewPassword
    })
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' })
  },

  toggleConfirmPassword() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    })
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' })
  }
})