// pages/admin/settings/notification.js
const app = getApp()

Page({
  data: {
    subscriptionStatus: {
      fileReceiveStatus: 'reject',
      fileProcessStatus: 'reject'
    },
    hasOpenid: false,
    globalError: '',
    submitting: false,
    showSuccessTip: false,
    successMessage: ''
  },

  onLoad() {
    this.loadSubscriptionStatus()
  },

  onPullDownRefresh() {
    this.loadSubscriptionStatus().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载订阅状态
  async loadSubscriptionStatus() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      wx.showLoading({ title: '加载中...' })
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/subscribe`,
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
          subscriptionStatus: {
            fileReceiveStatus: res.data.fileReceiveStatus || 'reject',
            fileProcessStatus: res.data.fileProcessStatus || 'reject'
          },
          hasOpenid: res.data.hasOpenid || false
        })
        
        // 如果没有绑定微信openid，显示提示
        if (!res.data.hasOpenid) {
          this.setData({
            globalError: '您当前账号未绑定微信，无法接收消息通知。请联系管理员或重新登录绑定微信。'
          })
        }
      } else {
        throw new Error('获取订阅状态失败')
      }
    } catch (err) {
      console.error('加载订阅状态失败:', err)
      wx.showToast({
        title: '获取状态失败',
        icon: 'none'
      })
    }
  },

  // 请求订阅消息权限
  async requestSubscription() {
    try {
      // 如果没有绑定openid，提示用户
      if (!this.data.hasOpenid) {
        wx.showModal({
          title: '未绑定微信',
          content: '您当前账号未绑定微信，无法接收消息通知。请联系管理员或重新登录绑定微信。',
          showCancel: false
        })
        return
      }
      
      this.setData({ submitting: true })
      
      // 请求订阅消息权限
      const result = await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [
            '', // 收到文件通知模板ID - 需要替换为实际模板ID
            ''  // 文件处理结果通知模板ID - 需要替换为实际模板ID
          ],
          success: resolve,
          fail: reject
        })
      })
      
      console.log('订阅结果:', result)
      
      // 获取订阅结果
      const subscribeStatus = {
        fileReceiveStatus: result[''] || 'reject', // 需要替换为实际模板ID
        fileProcessStatus: result[''] || 'reject'  // 需要替换为实际模板ID
      }
      
      // 将订阅状态提交到后端保存
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/subscribe`,
          method: 'POST',
          data: subscribeStatus,
          header: {
            'Authorization': `Bearer ${wx.getStorageSync('token')}`
          },
          success: resolve,
          fail: reject
        })
      })
      
      if (res.statusCode === 200) {
        // 更新本地状态
        this.setData({
          subscriptionStatus: subscribeStatus
        })
        
        // 轻微振动反馈
        wx.vibrateShort({ type: 'light' })
        
        // 显示成功提示
        this.showSuccess('通知设置已更新')
      } else {
        throw new Error(res.data.error || '保存设置失败')
      }
    } catch (err) {
      console.error('更新订阅设置失败:', err)
      
      // 如果是用户取消，显示特定提示
      if (err.errMsg && err.errMsg.includes('user cancel')) {
        wx.showToast({
          title: '已取消订阅',
          icon: 'none'
        })
      } else {
        this.setData({
          globalError: err.message || '设置失败，请重试'
        })
        
        wx.showToast({
          title: '设置失败',
          icon: 'none'
        })
      }
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