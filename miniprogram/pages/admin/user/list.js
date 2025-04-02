const app = getApp()

Page({
  data: {
    users: [],
    searchTypeIndex: 0,
    searchValue: '',
    showEditModal: false,
    editUser: null,
    showPassword: false,
    modalTitle: '编辑用户信息'
  },

  onLoad(options) {
    this.loadUsers()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2  // 用户管理
      })
    }
  },

  onPullDownRefresh() {
    this.loadUsers().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 阻止模态框背景的滚动事件冒泡
  preventTouchMove() {
    return false;
  },

  loadUsers() {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '加载中...' });
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/admin/users`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            console.log('用户数据:', res.data.users); // 调试用
            
            // 处理每个用户的头像URL
            const users = res.data.users.map(user => {
              // 如果服务器返回的头像URL有效，添加服务器基础URL
              if (user.avatar_url && user.avatar_url.startsWith('/static/')) {
                user.avatar_url = app.globalData.baseUrl + user.avatar_url;
              } else {
                // 设置默认头像为本地路径
                user.avatar_url = '/images/default-avatar.png';
              }
              return user;
            });
            
            this.setData({
              users: users
            });
          } else {
            wx.showToast({
              title: '获取用户列表失败',
              icon: 'none'
            });
          }
          resolve();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('加载用户列表失败:', err);
          wx.showToast({
            title: '加载失败',
            icon: 'error'
          });
          reject(err);
        }
      });
    });
  },
  
  onSearchTypeChange(e) {
    this.setData({
      searchTypeIndex: e.detail.value
    });
  },

  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });
    if (!e.detail.value) {
      this.loadUsers();
    }
  },

  handleSearch() {
    const searchTypes = ['username', 'company_name', 'contact_info', 'industry', 'recruitment_unit'];
    const searchType = searchTypes[this.data.searchTypeIndex];
    const searchValue = this.data.searchValue.toLowerCase();

    const filteredUsers = this.data.users.filter(user => {
      let searchText = '';
      switch (searchType) {
        case 'username':
          searchText = user.username ? user.username.toLowerCase() : '';
          break;
        case 'company_name':
          searchText = (user.company_name || '').toLowerCase();
          break;
        case 'contact_info':
          searchText = (user.contact_info || '').toLowerCase();
          break;
        case 'industry':
          searchText = (user.industry || '').toLowerCase();
          break;
        case 'recruitment_unit':
          searchText = (user.recruitment_unit || '').toLowerCase();
          break;
      }
      return searchText.includes(searchValue);
    });

    this.setData({
      users: filteredUsers
    });
  },

  // 导航到用户详情页
  navigateToDetail(e) {
    const userId = e.currentTarget.dataset.id;
    
    // 防止点击操作按钮时触发跳转
    if (e.target.dataset.stopPropagation) {
      return;
    }
    
    wx.navigateTo({
      url: `/pages/admin/user/detail?id=${userId}`,
    });
  },

  addUser() {
    this.setData({
      showEditModal: true,
      modalTitle: '添加新用户',
      showPassword: false,
      editUser: {
        id: '',
        username: '',
        company_name: '',
        contact_info: '',
        company_address: '',
        industry: '',
        recruitment_unit: '',
        is_admin: false
      }
    });
  },

  editUser(e) {
    const user = e.currentTarget.dataset.user;
    // 打印用户数据以确保所有字段都存在
    console.log('编辑用户:', user);
    
    // 使用Object.assign创建一个新对象，避免直接修改原对象
    const editUserData = Object.assign({}, user);
    
    // 检查是否有企业信息字段，如果没有则设置为空字符串避免undefined
    if (!editUserData.company_address) editUserData.company_address = '';
    if (!editUserData.industry) editUserData.industry = '';
    if (!editUserData.recruitment_unit) editUserData.recruitment_unit = '';
    
    this.setData({
      showEditModal: true,
      modalTitle: '编辑用户信息',
      showPassword: false,
      editUser: editUserData
    });
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editUser: null,
      showPassword: false
    });
  },

  togglePassword(e) {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },
  
  submitEdit(e) {
    const formData = e.detail.value;
    const userId = formData.id;

    // 构建请求数据
    const requestData = {
      username: formData.username,
      company_name: formData.company_name,
      contact_info: formData.contact_info,
      // 新增字段
      company_address: formData.company_address,
      industry: formData.industry,
      recruitment_unit: formData.recruitment_unit,
      is_admin: formData.is_admin === 'true' || formData.is_admin === true
    };

    // 如果是新增用户或密码不为空，则添加到请求数据中
    if (!userId || formData.password) {
      requestData.password = formData.password;
    }

    // 表单验证
    if (!requestData.username) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      });
      return;
    }

    if (!userId && !formData.password) {
      wx.showToast({
        title: '密码不能为空',
        icon: 'none'
      });
      return;
    }

    // 根据是否有userId判断是新增还是编辑
    const url = userId ? 
      `${app.globalData.baseUrl}/api/v1/admin/users/${userId}` :
      `${app.globalData.baseUrl}/api/v1/admin/users`;
    const method = userId ? 'PUT' : 'POST';

    wx.showLoading({ title: userId ? '更新中...' : '添加中...' });

    wx.request({
      url: url,
      method: method,
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 || res.statusCode === 201) {
          wx.showToast({
            title: userId ? '更新成功' : '添加成功',
            icon: 'success'
          });
          this.closeEditModal();
          this.loadUsers();
        } else {
          let errorMsg = res.data && res.data.error ? res.data.error : '操作失败';
          wx.showToast({
            title: errorMsg,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('操作失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  deleteUser(e) {
    const userId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此用户吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.request({
            url: `${app.globalData.baseUrl}/api/v1/admin/users/${userId}`,
            method: 'DELETE',
            header: {
              'Authorization': `Bearer ${wx.getStorageSync('token')}`
            },
            success: (res) => {
              wx.hideLoading();
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                this.loadUsers();
              } else {
                wx.showToast({
                  title: res.data && res.data.error ? res.data.error : '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('删除用户失败:', err);
              wx.showToast({
                title: '删除失败',
                icon: 'error'
              });
            }
          });
        }
      }
    });
  }
});