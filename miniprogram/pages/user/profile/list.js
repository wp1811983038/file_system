// pages/user/profile/list.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    isUserInfoExpanded: false,
    showSuccessTip: false,
    successMessage: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    console.log('个人中心页面显示')
    // 确保正确设置TabBar的选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1  // 个人中心的索引
      })
    }
    
    // 重新加载用户信息，确保数据最新
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    this.loadUserInfo().then(() => {
      wx.stopPullDownRefresh()
    })
  },
  
  // 切换用户信息展开/折叠状态
  toggleUserInfoExpand() {
    this.setData({
      isUserInfoExpanded: !this.data.isUserInfoExpanded
    })
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' })
  },

  // 跳转到编辑个人资料页面
  navigateToEditProfile() {
    wx.navigateTo({
      url: '/pages/user/profile/edit',
    })
  },

  // 跳转到修改密码页面
  navigateToChangePassword() {
    wx.navigateTo({
      url: '/pages/user/password/list',
    })
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
  }
})