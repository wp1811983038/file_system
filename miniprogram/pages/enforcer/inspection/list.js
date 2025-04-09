// pages/enforcer/inspection/list.js
const app = getApp()

Page({
  data: {
    activeTab: 'all',
    inspections: [],
    page: 1,
    limit: 10,
    hasMoreData: false,
    searchKeyword: ''
  },

  onLoad(options) {
    // 如果有状态参数，设置默认活动标签
    if (options.status) {
      this.setData({
        activeTab: options.status
      })
    }
    
    this.loadInspections()
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      inspections: []
    })
    
    this.loadInspections().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载检查任务列表
  // 加载检查任务列表
// 加载检查任务列表
async loadInspections() {
  try {
    wx.showLoading({ title: '加载中...' });
    
    // 打印请求信息便于调试
    const url = `${app.globalData.baseUrl}/api/v1/enforcer/inspections`;
    console.log('请求检查任务列表URL:', url);
    console.log('查询参数:', {
      page: this.data.page,
      limit: this.data.limit,
      status: this.data.activeTab !== 'all' ? this.data.activeTab : '',
      keyword: this.data.searchKeyword
    });
    
    // 正确包装wx.request为Promise
    const res = await new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'GET',
        data: {
          page: this.data.page,
          limit: this.data.limit,
          status: this.data.activeTab !== 'all' ? this.data.activeTab : '',
          keyword: this.data.searchKeyword
        },
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (result) => {
          console.log('检查任务列表响应:', result);
          resolve(result);
        },
        fail: (error) => {
          console.error('检查任务列表请求失败:', error);
          reject(error);
        }
      });
    });
    
    // 安全处理响应数据
    if (res && res.statusCode === 200 && res.data) {
      console.log('获取到检查任务数据:', res.data);
      
      // 如果是第一页，替换数据，否则追加数据
      const inspections = this.data.page === 1 ? 
        res.data.inspections || [] : 
        [...this.data.inspections, ...(res.data.inspections || [])];
      
      this.setData({
        inspections,
        hasMoreData: inspections.length < (res.data.total || 0)
      });
    } else {
      console.error('API响应错误:', res);
      wx.showToast({
        title: '获取检查任务失败',
        icon: 'none'
      });
    }
  } catch (err) {
    console.error('加载检查任务列表失败:', err);
    wx.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } finally {
    wx.hideLoading();
  }
},

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    
    if (tab !== this.data.activeTab) {
      this.setData({
        activeTab: tab,
        page: 1,
        inspections: []
      })
      
      this.loadInspections()
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 执行搜索
  searchInspections() {
    this.setData({
      page: 1,
      inspections: []
    })
    
    this.loadInspections()
  },

  // 加载更多数据
  loadMoreData() {
    if (this.data.hasMoreData) {
      this.setData({
        page: this.data.page + 1
      })
      
      this.loadInspections()
    }
  },

  // 导航到检查任务详情
  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/enforcer/inspection/detail?id=${id}`
    })
  },

  // 导航到执行检查或查看详情
  navigateToAction(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    
    if (status === 'completed') {
      wx.navigateTo({
        url: `/pages/enforcer/inspection/detail?id=${id}`
      })
    } else {
      wx.navigateTo({
        url: `/pages/enforcer/inspection/execute?id=${id}`
      })
    }
  }
})