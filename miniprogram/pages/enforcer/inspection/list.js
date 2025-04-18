// pages/enforcer/inspection/list.js
const app = getApp();

Page({
  data: {
    activeTab: 'all',        // 当前选中的标签：all, pending, completed
    keyword: '',             // 搜索关键词
    page: 1,                 // 当前页码
    perPage: 10,             // 每页数量
    inspections: [],         // 检查任务列表
    hasMoreData: true,       // 是否还有更多数据
    isLoading: false         // 是否正在加载
  },

  onLoad(options) {
    // 如果URL传入了标签类型，设置为当前激活的标签
    if (options.type && ['all', 'pending', 'completed'].includes(options.type)) {
      this.setData({ activeTab: options.type });
    }
    
    // 加载检查任务列表
    this.loadInspections();
  },

  onShow() {
    // 每次页面显示时，刷新数据
    this.setData({
      page: 1,
      inspections: [],
      hasMoreData: true
    }, () => {
      this.loadInspections();
    });
  },

  onPullDownRefresh() {
    // 下拉刷新
    this.setData({
      page: 1,
      inspections: [],
      hasMoreData: true
    }, () => {
      this.loadInspections().then(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 切换标签
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    
    if (type !== this.data.activeTab) {
      this.setData({
        activeTab: type,
        page: 1,
        inspections: [],
        hasMoreData: true
      }, () => {
        this.loadInspections();
      });
    }
  },

  // 输入关键词
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 清除关键词
  clearKeyword() {
    this.setData({ 
      keyword: '',
      page: 1,
      inspections: [],
      hasMoreData: true
    }, () => {
      this.loadInspections();
    });
  },

  // 搜索检查任务
  searchInspections(e) {
    // 重置页码
    this.setData({
      page: 1,
      inspections: [],
      hasMoreData: true
    }, () => {
      this.loadInspections();
    });
  },

  // 加载检查任务列表
  loadInspections() {
    if (this.data.isLoading || !this.data.hasMoreData) return Promise.resolve();
    
    this.setData({ isLoading: true });
    
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return resolve();
      }
      
      // 构建API请求参数
      let params = `page=${this.data.page}&limit=${this.data.perPage}`;
      
      // 添加过滤条件
      if (this.data.activeTab !== 'all') {
        params += `&status=${this.data.activeTab}`;
      }
      
      // 添加搜索关键词
      if (this.data.keyword) {
        params += `&keyword=${encodeURIComponent(this.data.keyword)}`;
      }
      
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections?${params}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const newData = res.data.inspections || [];
            
            this.setData({
              inspections: [...this.data.inspections, ...newData],
              hasMoreData: newData.length >= this.data.perPage,
              page: this.data.page + 1,
              isLoading: false
            });
          } else {
            this.setData({ isLoading: false });
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
          }
          resolve();
        },
        fail: (err) => {
          console.error('加载检查任务失败:', err);
          this.setData({ isLoading: false });
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 加载更多
  loadMore() {
    if (!this.data.isLoading && this.data.hasMoreData) {
      this.loadInspections();
    }
  },

  // 查看检查详情
  viewInspectionDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/enforcer/inspection/detail?id=${id}`
    });
  },

  // 创建新检查任务
  createNewInspection() {
    wx.navigateTo({
      url: '/pages/enforcer/inspection/create'
    });
  },

  // 显示删除确认对话框
  showDeleteConfirm(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此检查任务吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.deleteInspection(id);
        }
      }
    });
  },

  // 删除检查任务
  deleteInspection(id) {
    const token = wx.getStorageSync('token');
    
    wx.showLoading({ title: '删除中...' });
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/enforcer/inspections/${id}`,
      method: 'DELETE',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          
          // 刷新列表
          this.setData({
            page: 1,
            inspections: [],
            hasMoreData: true
          }, () => {
            this.loadInspections();
          });
        } else {
          wx.showToast({
            title: res.data.error || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('删除检查任务失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
});