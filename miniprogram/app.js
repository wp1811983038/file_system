App({
  globalData: {
    // 固定配置 baseUrl，不再使用 process.env
    baseUrl: 'http://192.168.1.4:5000',//192.168.1.101,47.115.207.238
    // 如需在生产环境使用其他URL，可以手动切换或通过其他方式配置
    // baseUrl: 'https://pdswjgl.cn:5000',
    userInfo: null,
    networkStatus: {
      isConnected: true,
      networkType: 'unknown'
    }
  },
  
  onLaunch() {
    // 监听网络状态
    this._initNetworkListener()
    
    // 检查登录状态
    this._checkLoginStatus()
  },
  
  _initNetworkListener() {
    // 获取初始网络状态
    wx.getNetworkType({
      success: (res) => {
        this.globalData.networkStatus.networkType = res.networkType
        this.globalData.networkStatus.isConnected = res.networkType !== 'none'
      }
    })
    
    // 监听网络变化
    wx.onNetworkStatusChange((res) => {
      console.log('网络状态变化:', res)
      this.globalData.networkStatus.isConnected = res.isConnected
      this.globalData.networkStatus.networkType = res.networkType
      
      // 网络恢复后可以触发页面刷新等操作
      if (res.isConnected) {
        const currentPages = getCurrentPages()
        const currentPage = currentPages[currentPages.length - 1]
        if (currentPage && typeof currentPage.onNetworkResume === 'function') {
          currentPage.onNetworkResume()
        }
      }
    })
  },
  
  _checkLoginStatus() {
    const token = wx.getStorageSync('token')
    if (!token) {
      // 如果是登录页面则不跳转
      const pages = getCurrentPages()
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1]
        if (currentPage && currentPage.route !== 'pages/login/login') {
          // 未登录时重定向到登录页
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }
      }
    }
  },
  
  // 封装请求方法便于统一处理
  request(options) {
    const token = wx.getStorageSync('token')
    
    // 合并默认配置
    const requestOptions = {
      url: this.globalData.baseUrl + options.url,
      header: {
        'Content-Type': options.contentType || 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      method: options.method || 'GET',
      data: options.data || {},
      ...options
    }
    
    // 检查网络状态
    if (!this.globalData.networkStatus.isConnected) {
      wx.showToast({
        title: '网络连接不可用',
        icon: 'none'
      })
      
      if (typeof options.fail === 'function') {
        options.fail({errMsg: '网络连接不可用'})
      }
      
      return new Promise((resolve, reject) => {
        reject({errMsg: '网络连接不可用'})
      })
    }
    
    return new Promise((resolve, reject) => {
      wx.request({
        ...requestOptions,
        success: (res) => {
          // 统一处理登录失效
          if (res.statusCode === 401) {
            wx.removeStorageSync('token')
            wx.showModal({
              title: '提示',
              content: '登录已过期，请重新登录',
              showCancel: false,
              success: () => {
                wx.redirectTo({
                  url: '/pages/login/login'
                })
              }
            })
            reject(res)
            return
          }
          
          // 服务器错误处理
          if (res.statusCode >= 500) {
            wx.showToast({
              title: '服务器暂时不可用',
              icon: 'none'
            })
            reject(res)
            return
          }
          
          if (typeof options.success === 'function') {
            options.success(res)
          }
          resolve(res)
        },
        fail: (err) => {
          console.error('请求失败:', options.url, err)
          if (typeof options.fail === 'function') {
            options.fail(err)
          }
          reject(err)
        },
        complete: options.complete
      })
    })
  },
  
  onError(err) {
    console.error('应用错误:', err)
    // 可以添加错误上报逻辑
  }
})