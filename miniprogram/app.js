// 导入腾讯位置服务SDK
const QQMapWX = require('./utils/qqmap-wx-jssdk.js');

App({
  globalData: {
    baseUrl: '',//192.168.1.101,    
    // 如需在生产环境使用其他URL，可以手动切换或通过其他方式配置
    // baseUrl: '',
    userInfo: null,
    userRole: null, // 添加用户角色信息
    networkStatus: {
      isConnected: true,
      networkType: 'unknown'
    },
    // 添加腾讯地图SDK实例
    qqmapsdk: null
  },
  
  onLaunch() {
    // 初始化腾讯位置服务
    this.globalData.qqmapsdk = new QQMapWX({
      key: '' // 替换为您申请的腾讯位置服务密钥
    });
    
    // 从本地存储加载用户角色
    const userRole = wx.getStorageSync('userRole') || 'user';
    this.globalData.userRole = userRole;

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
      // 未登录时的处理保持不变...
    } else {
      // 已登录，检查当前页面是否符合用户角色
      const userRole = wx.getStorageSync('userRole') || 'user';
      const pages = getCurrentPages();
      
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        const route = currentPage.route || '';
        
        console.log('当前页面:', route, '用户角色:', userRole);
        
        // 强制重定向到对应角色的首页
        if (userRole === 'enforcer' && !route.includes('enforcer/') && !route.includes('login')) {
          console.log('执法人员访问非法页面，重定向到执法端首页');
          wx.reLaunch({ url: '/pages/enforcer/index/index' });
        } else if (userRole === 'admin' && !route.includes('admin/') && !route.includes('login')) {
          wx.reLaunch({ url: '/pages/admin/index/index' });
        } else if (userRole === 'user' && (route.includes('admin/') || route.includes('enforcer/')) && !route.includes('login')) {
          wx.reLaunch({ url: '/pages/user/files/list' });
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
  
  // 地理编码方法 - 将地址转换为经纬度
  // app.js中添加或修改的方法
geocoder(address) {
  return new Promise((resolve, reject) => {
    this.globalData.qqmapsdk.geocoder({
      address: address,
      success: res => {
        if (res.status === 0) {
          resolve(res.result);
        } else {
          reject(new Error(res.message || '地址解析失败'));
        }
      },
      fail: error => {
        reject(error);
      }
    });
  });
},
  
  onError(err) {
    console.error('应用错误:', err)
    // 可以添加错误上报逻辑
  }
})