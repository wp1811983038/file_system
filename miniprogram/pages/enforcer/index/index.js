// miniprogram/pages/enforcer/index/index.js
const app = getApp()

Page({
  data: {
    stats: {
      company_count: 0,
      template_count: 0,
      submission_count: 0,
      approved_count: 0,
      compliance_rate: 0
    }
  },

  onLoad() {
    this.loadDashboardData()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0  // 首页
      })
    }
  },

  onPullDownRefresh() {
    this.loadDashboardData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载执法端首页数据
  async loadDashboardData() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/dashboard`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          stats: res.data
        })
      } else {
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载执法端首页数据失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})