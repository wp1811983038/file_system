const app = getApp()

Page({
  data: {
    users: [],
    searchTypeIndex: 0,
    searchValue: '',
    showEditModal: false,
    editUser: null,
    showPassword: false,
    modalTitle: '编辑用户信息',
    errors: {}
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
    // 每次进入页面时刷新用户列表
    this.loadUsers();
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
      // 添加随机参数避免缓存
      const timestamp = new Date().getTime();
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/admin/users?t=${timestamp}`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            console.log('获取到的原始用户数据:', res.data.users);
            
            // 处理每个用户的头像URL和角色标记
            const users = res.data.users.map(user => {
              // 确保角色字段有值，如果没有则基于is_admin设置一个默认值
              if (!user.role) {
                user.role = user.is_admin ? 'admin' : 'user';
                console.log(`用户 ${user.username} 角色为undefined，设置默认值: ${user.role}`);
              }
              
              // 记录用户角色信息
              console.log(`用户 ${user.username} (ID: ${user.id}) 的角色: ${user.role}, 是否管理员: ${user.is_admin}`);
              
              // 如果服务器返回的头像URL有效，添加服务器基础URL
              if (user.avatar_url && user.avatar_url.startsWith('/static/')) {
                user.avatar_url = app.globalData.baseUrl + user.avatar_url;
              } else {
                // 设置默认头像为本地路径
                user.avatar_url = '/images/default-avatar.png';
              }
              return user;
            });
            
            // 根据角色排序：管理员 > 执法人员 > 普通用户
            users.sort((a, b) => {
              // 确定角色优先级
              const getRolePriority = (user) => {
                if (user.role === 'admin' || user.is_admin) return 0; // 管理员优先级最高
                if (user.role === 'enforcer') return 1; // 执法人员第二
                return 2; // 普通用户优先级最低
              };
              
              // 获取优先级
              const priorityA = getRolePriority(a);
              const priorityB = getRolePriority(b);
              
              console.log(`排序: ${a.username} (${a.role}, 优先级: ${priorityA}) vs ${b.username} (${b.role}, 优先级: ${priorityB})`);
              
              return priorityA - priorityB;
            });
            
            console.log('排序后的用户列表顺序:');
            users.forEach((user, index) => {
              // console.log(`${index+1}. ${user.username} - 角色: ${user.role}`);
            });
            
            // 使用setData更新列表前清空现有列表，避免状态混淆
            this.setData({
              users: []
            }, () => {
              // 在回调中设置新的列表，确保UI完全刷新
              this.setData({
                users: users
              });
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

    // 先确保有最新的用户数据
    this.loadUsers().then(() => {
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
        role: 'user', // 设置默认角色为普通用户
        is_admin: false
      },
      errors: {}
    });
  },

  editUser(e) {
    const user = e.currentTarget.dataset.user;
    // 打印用户数据以确保所有字段都存在
    console.log('编辑用户:', user);
    
    // 使用深拷贝创建一个新对象，避免直接修改原对象
    const editUserData = JSON.parse(JSON.stringify(user));
    
    // 检查是否有企业信息字段，如果没有则设置为空字符串避免undefined
    if (!editUserData.company_address) editUserData.company_address = '';
    if (!editUserData.industry) editUserData.industry = '';
    if (!editUserData.recruitment_unit) editUserData.recruitment_unit = '';
    
    // 确保角色字段存在并正确设置
    if (!editUserData.role) {
      editUserData.role = editUserData.is_admin ? 'admin' : 'user';
      console.log(`用户${editUserData.username}角色为undefined，设置默认值: ${editUserData.role}`);
    }
    
    // 记录当前角色用于调试
    console.log(`开始编辑用户 ${editUserData.username}，角色为: ${editUserData.role}`);
    
    this.setData({
      showEditModal: true,
      modalTitle: '编辑用户信息',
      showPassword: false,
      editUser: editUserData,
      errors: {}
    });
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editUser: null,
      showPassword: false,
      errors: {}
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
    
    // 清除之前的错误
    this.setData({
      errors: {}
    });

    // 构建基本请求数据 - 始终包含role字段和username
    const requestData = {
      role: formData.role,
      username: formData.username
    };
    
    // 添加其他字段
    if (formData.company_name) {
      requestData.company_name = formData.company_name;
    }
    
    if (formData.contact_info) {
      requestData.contact_info = formData.contact_info;
    }
    
    if (formData.company_address) {
      requestData.company_address = formData.company_address;
    }
    
    if (formData.industry) {
      requestData.industry = formData.industry;
    }
    
    if (formData.recruitment_unit) {
      requestData.recruitment_unit = formData.recruitment_unit;
    }
    
    // 添加调试信息
    console.log('提交的角色值:', formData.role);
    console.log('提交的请求数据:', requestData);

    // 根据角色设置is_admin
    requestData.is_admin = formData.role === 'admin';

    // 如果是新增用户或密码不为空，则添加到请求数据中
    if (!userId || formData.password) {
      requestData.password = formData.password;
    }

    // 表单验证
    let hasError = false;
    let errors = {};
    
    if (!formData.username) {
      errors.username = '用户名不能为空';
      hasError = true;
    }

    if (!userId && !formData.password) {
      errors.password = '密码不能为空';
      hasError = true;
    }
    
    // 手机号验证
    if (formData.contact_info && !/^1[3-9]\d{9}$/.test(formData.contact_info)) {
      errors.contact_info = '请输入有效的手机号码';
      hasError = true;
    }
    
    if (hasError) {
      this.setData({ errors });
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
        console.log('API响应数据:', res.data);
        if (res.statusCode === 200 || res.statusCode === 201) {
          wx.showToast({
            title: userId ? '更新成功' : '添加成功',
            icon: 'success'
          });
          this.closeEditModal();
          
          // 延迟执行加载用户列表，确保服务器有足够时间处理
          setTimeout(() => {
            console.log('开始重新加载用户列表...');
            // 强制刷新用户列表
            this.forceRefresh();
          }, 1000);
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
                // 删除成功后重新加载列表
                setTimeout(() => {
                  this.forceRefresh();
                }, 500);
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
  },
  
  // 添加强制刷新方法
  forceRefresh() {
    console.log('强制刷新用户列表...');
    // 清空现有列表
    this.setData({
      users: []
    }, () => {
      // 短暂延迟后重新加载
      setTimeout(() => {
        this.loadUsers();
      }, 100);
    });
  }
});