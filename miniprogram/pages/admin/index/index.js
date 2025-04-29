// index.js
const app = getApp()

Page({
  data: {
    stats: {
      template_count: 0,
      user_count: 0, 
      today_uploads: 0
    },
    activities: [],
    messages: []  // 添加消息数据
  },

  onLoad() {
    wx.showLoading({ title: '加载中...' })
    
    Promise.all([
      this.loadStats(),
      this.loadActivities(),
      this.loadMessages()  // 添加加载消息的方法
    ]).finally(() => {
      wx.hideLoading()
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
    
    // 每次页面显示时，刷新所有数据
    this.setData({
      page: 1,
      companies: [],
      pendingInspections: []
    }, () => {
      this.loadDashboardData();
      this.loadCompanies();
      this.loadPendingInspections();
    });
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadStats(),
      this.loadActivities(),
      this.loadMessages()  // 添加刷新消息
    ]).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadStats() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/admin/stats`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          console.log('Stats response:', res.data)
          if (res.statusCode === 200 && res.data) {
            this.setData({
              stats: {
                template_count: res.data.template_count || 0,
                user_count: res.data.user_count || 0,
                today_uploads: res.data.today_uploads || 0
              }
            })
          }
          resolve()
        },
        fail: (err) => {
          console.error('加载统计数据失败:', err)
          reject(err)
        }
      })
    })
  },

  loadActivities() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/admin/submissions`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          console.log('Activities response:', res.data)
          if (res.statusCode === 200 && res.data && Array.isArray(res.data.submissions)) {
            this.setData({
              activities: res.data.submissions.map(file => ({
                id: file.id,
                username: file.user.username,
                action: `上传了 ${file.template.name}`,
                time: file.upload_date,
                fileType: file.template.name,
                filename: file.filename
              }))
            })
          }
          resolve()
        },
        fail: (err) => {
          console.error('加载活动数据失败:', err)
          reject(err)
        }
      })
    })
  },
  
  // 新增：加载消息
  // 新增：加载消息
loadMessages() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/messages`,
      method: 'GET',
      data: {
        page: 1,
        per_page: 1  // 只获取最新的1条
      },
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        console.log('Messages response:', res.data)
        if (res.statusCode === 200 && res.data && res.data.messages) {
          // 处理消息内容预览（截取前50个字符）
          const messages = res.data.messages.map(msg => {
            return {
              ...msg,
              content: msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content
            }
          })
          
          this.setData({ 
            messages,
            hasMoreMessages: (res.data.total || 0) > 1  // 标记是否有更多消息
          })
        }
        resolve()
      },
      fail: (err) => {
        console.error('加载消息失败:', err)
        reject(err)
      }
    })
  })
},
  
  // 查看消息详情
  viewMessageDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/admin/message/detail?id=${id}`
    })
  },
  
  // 查看更多消息
  viewMoreMessages() {
    wx.navigateTo({
      url: '/pages/admin/message/list'
    })
  }
})