// pages/admin/message/list.js
const app = getApp();

Page({
  data: {
    activeTab: 'all',
    messages: [],
    page: 1,
    perPage: 10,
    hasMoreData: true,
    isLoading: false,
    unreadCount: 0
  },

  onLoad() {
    this.loadMessages();
    this.getUnreadCount();
  },

  onShow() {
    // 页面显示时刷新未读消息数
    this.getUnreadCount();
  },

  onPullDownRefresh() {
    // 重置分页参数
    this.setData({
      page: 1,
      hasMoreData: true,
      messages: []
    }, () => {
      this.loadMessages().then(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 切换标签
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    
    this.setData({
      activeTab: type,
      page: 1,
      hasMoreData: true,
      messages: []
    }, () => {
      this.loadMessages();
    });
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' });
  },

  // 加载消息列表
  async loadMessages() {
    if (this.data.isLoading || !this.data.hasMoreData) return;
    
    this.setData({ isLoading: true });
    
    try {
      const token = wx.getStorageSync('token');
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }
      
      // 构建请求参数
      let url = `${app.globalData.baseUrl}/api/v1/messages?page=${this.data.page}&per_page=${this.data.perPage}`;
      
      // 添加消息类型过滤
      if (this.data.activeTab !== 'all') {
        url += `&type=${this.data.activeTab}`;
      }
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: url,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        // 处理消息内容预览（截取前50个字符）
        const messages = res.data.messages.map(msg => {
          return {
            ...msg,
            content: msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content
          };
        });
        
        this.setData({
          messages: [...this.data.messages, ...messages],
          hasMoreData: res.data.pages > this.data.page,
          page: this.data.page + 1
        });
      } else {
        throw new Error('获取消息列表失败');
      }
    } catch (err) {
      console.error('加载消息列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  // 获取未读消息数
  async getUnreadCount() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) return;
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/messages/unread/count`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        this.setData({ unreadCount: res.data.count });
      }
    } catch (err) {
      console.error('获取未读消息数失败:', err);
    }
  },

  // 查看消息详情
  viewMessageDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/message/detail?id=${id}`
    });
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' });
  },

  // 全部标为已读
  async markAllAsRead() {
    try {
      const token = wx.getStorageSync('token');
      if (!token) return;
      
      wx.showLoading({ title: '处理中...' });
      
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/messages/read/all`,
          method: 'PUT',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        });
      });
      
      if (res.statusCode === 200) {
        // 更新所有消息状态为已读
        const updatedMessages = this.data.messages.map(msg => {
          return {
            ...msg,
            status: 'read'
          };
        });
        
        this.setData({
          messages: updatedMessages,
          unreadCount: 0
        });
        
        wx.showToast({
          title: '全部已读',
          icon: 'success'
        });
        
        // 添加触感反馈
        wx.vibrateShort();
      } else {
        throw new Error('操作失败');
      }
    } catch (err) {
      console.error('标记全部已读失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 上拉加载更多
  loadMore() {
    if (!this.data.isLoading && this.data.hasMoreData) {
      this.loadMessages();
    }
  }
});