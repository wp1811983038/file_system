// miniprogram/pages/enforcer/index/index.js
const app = getApp()

Page({
  data: {
    stats: {
      company_count: 0,
      pending_count: 0,
      completed_count: 0
    },
    searchKeyword: '',
    companies: [],
    pendingInspections: [],
    page: 1,
    limit: 10,
    hasMoreCompanies: false
  },

  onLoad() {
    this.loadDashboardData()
    this.loadCompanies()
    this.loadPendingInspections()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      companies: [],
      pendingInspections: []
    })
    
    Promise.all([
      this.loadDashboardData(),
      this.loadCompanies(),
      this.loadPendingInspections()
    ]).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载统计数据
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
          stats: {
            company_count: res.data.company_count || 0,
            pending_count: res.data.pending_count || 0,
            completed_count: res.data.completed_count || 0
          }
        })
      } else {
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载数据失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载企业列表
  async loadCompanies() {
    try {
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/companies`,
        method: 'GET',
        data: {
          page: this.data.page,
          limit: this.data.limit,
          keyword: this.data.searchKeyword
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        // 如果是第一页，替换数据，否则追加数据
        const companies = this.data.page === 1 ? 
          res.data.companies : 
          [...this.data.companies, ...res.data.companies]
        
        this.setData({
          companies,
          hasMoreCompanies: companies.length < res.data.total
        })
      } else {
        wx.showToast({
          title: '获取企业列表失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载企业列表失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载待检查任务
  async loadPendingInspections() {
    try {
      const res = await wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/pending`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        }
      })
      
      if (res.statusCode === 200) {
        this.setData({
          pendingInspections: res.data.inspections
        })
      } else {
        wx.showToast({
          title: '获取待检查任务失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载待检查任务失败:', err)
    }
  },

  // 搜索输入处理
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 搜索企业
  searchCompany() {
    this.setData({
      page: 1,
      companies: []
    })
    this.loadCompanies()
  },

  // 加载更多企业
  loadMoreCompanies() {
    this.setData({
      page: this.data.page + 1
    })
    this.loadCompanies()
  },

  // 选择企业
  selectCompany(e) {
    const companyId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/enforcer/company/detail?id=${companyId}`
    })
  },

  // 导航到待执行检查
  navigateToInspection(e) {
    const inspectionId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/enforcer/inspection/execute?id=${inspectionId}`
    })
  },

  // 导航到企业列表
  navigateToCompanies() {
    wx.navigateTo({
      url: '/pages/enforcer/company/list'
    })
  },

  // 导航到待检查列表
  navigateToInspections() {
    wx.navigateTo({
      url: '/pages/enforcer/inspection/list?status=pending'
    })
  },

  // 导航到已完成检查列表
  navigateToCompleted() {
    wx.navigateTo({
      url: '/pages/enforcer/inspection/list?status=completed'
    })
  },

  // 显示企业选择器
  showCompanySelector() {
    wx.navigateTo({
      url: '/pages/enforcer/company/selector'
    })
  }
})