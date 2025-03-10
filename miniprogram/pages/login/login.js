const app = getApp()

Page({
  data: {
    username: '',
    password: '',
    isLoading: false,
    rememberPassword: false,
    usernameError: '',
    passwordError: ''
  },

  onLoad() {
    // 检查是否有保存的登录信息
    const savedUsername = wx.getStorageSync('savedUsername')
    const savedPassword = wx.getStorageSync('savedPassword')
    
    if (savedUsername && savedPassword) {
      this.setData({
        username: savedUsername,
        password: savedPassword,
        rememberPassword: true
      })
    }
  },

  onUsernameInput(e) {
    this.setData({
      username: e.detail.value,
      usernameError: ''
    })
  },

  onPasswordInput(e) {
    this.setData({
      password: e.detail.value,
      passwordError: ''
    })
  },

  toggleRememberPassword() {
    this.setData({
      rememberPassword: !this.data.rememberPassword
    })
  },

  validateForm() {
    const { username, password } = this.data
    let isValid = true
    
    if (!username.trim()) {
      this.setData({ usernameError: '用户名不能为空' })
      isValid = false
    }
    
    if (!password) {
      this.setData({ passwordError: '密码不能为空' })
      isValid = false
    } else if (password.length < 6) {
      this.setData({ passwordError: '密码长度不能少于6位' })
      isValid = false
    }
    
    return isValid
  },

  handleLogin() {
    // 表单验证
    if (!this.validateForm()) {
      return
    }

    const { username, password, rememberPassword } = this.data
    
    // 设置加载状态
    this.setData({ isLoading: true })
    
    // 检查baseUrl是否存在
    if (!app.globalData || !app.globalData.baseUrl) {
      wx.showModal({
        title: '配置错误',
        content: '系统配置错误，请联系管理员',
        showCancel: false
      })
      this.setData({ isLoading: false })
      console.error('baseUrl未定义，请在app.js中设置globalData.baseUrl')
      return
    }

    // 发送登录请求
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/auth/login`,
      method: 'POST',
      data: {
        username,
        password
      },
      success: (res) => {
        console.log('登录响应:', res)
        if (res.statusCode === 200 && res.data.token) {
          // 保存token和用户角色
          wx.setStorageSync('token', res.data.token)
          wx.setStorageSync('isAdmin', res.data.is_admin)
          
          // 保存用户名密码（如果选择了记住密码）
          if (rememberPassword) {
            wx.setStorageSync('savedUsername', username)
            wx.setStorageSync('savedPassword', password)
          } else {
            wx.removeStorageSync('savedUsername')
            wx.removeStorageSync('savedPassword')
          }
          
          // 获取用户信息
          this.getUserInfo(res.data.token, res.data.is_admin)
        } else {
          // 处理登录失败的情况
          let errorMsg = '登录失败'
          let fieldErrors = {}
          
          if (res.data && res.data.error) {
            errorMsg = res.data.error
            
            // 根据错误消息类型设置字段级错误
            if (errorMsg.includes('用户名或密码错误')) {
              fieldErrors = {
                usernameError: '',
                passwordError: '用户名或密码错误'
              }
            }
          } else if (res.statusCode === 401) {
            errorMsg = '用户名或密码错误'
            fieldErrors = {
              usernameError: '',
              passwordError: '用户名或密码错误'
            }
          } else if (res.statusCode === 403) {
            errorMsg = '账号已被禁用，请联系管理员'
          } else if (res.statusCode >= 500) {
            errorMsg = '服务器错误，请稍后重试'
          }
          
          // 更新字段错误（如果有）
          if (Object.keys(fieldErrors).length > 0) {
            this.setData(fieldErrors)
          }
          
          // 显示错误提示对话框，而不是简单的Toast
          wx.showModal({
            title: '登录失败',
            content: errorMsg,
            showCancel: false
          })
          
          this.setData({ isLoading: false })
        }
      },
      fail: (err) => {
        console.error('登录请求失败:', err)
        let errorMsg = '网络错误，请检查网络连接后重试'
        
        // 处理特定错误类型
        if (err.errMsg && err.errMsg.includes('invalid url')) {
          errorMsg = '服务器地址配置错误，请联系管理员'
          console.error('请确保在app.js中正确设置了globalData.baseUrl')
        }
        
        // 使用弹窗提示具体错误，而不是简单的Toast
        wx.showModal({
          title: '连接错误',
          content: errorMsg,
          showCancel: false
        })
        
        this.setData({ isLoading: false })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  getUserInfo(token, isAdmin) {
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/users/profile`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        console.log('用户信息响应:', res)
        if (res.statusCode === 200) {
          // 添加振动反馈
          wx.vibrateShort({ type: 'light' })

          // 保存用户信息
          app.globalData.userInfo = res.data
          
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500,
            complete: () => {
              // 跳转到对应页面
              if (isAdmin) {
                wx.reLaunch({
                  url: '/pages/admin/index/index'
                })
              } else {
                wx.reLaunch({
                  url: '/pages/user/files/list'
                })
              }
            }
          })
        } else {
          // 处理获取用户信息失败的情况
          wx.showModal({
            title: '获取用户信息失败',
            content: '请重新登录或联系管理员',
            showCancel: false,
            success: () => {
              wx.removeStorageSync('token')
            }
          })
          this.setData({ isLoading: false })
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err)
        wx.showModal({
          title: '获取用户信息失败',
          content: '网络错误，请重试',
          showCancel: false,
          success: () => {
            wx.removeStorageSync('token')
          }
        })
        this.setData({ isLoading: false })
      }
    })
  }
})