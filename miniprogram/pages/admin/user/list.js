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

  loadUsers() {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/admin/users`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('token')}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            this.setData({
              users: res.data.users
            })
          }
          resolve()
        },
        fail: (err) => {
          console.error('加载用户列表失败:', err)
          wx.showToast({
            title: '加载失败',
            icon: 'error'
          })
          reject(err)
        }
      })
    })
  },

  onSearchTypeChange(e) {
    this.setData({
      searchTypeIndex: e.detail.value
    })
  },

  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    })
    if (!e.detail.value) {
      this.loadUsers()
    }
  },

  handleSearch() {
    const searchTypes = ['username', 'company', 'contact']
    const searchType = searchTypes[this.data.searchTypeIndex]
    const searchValue = this.data.searchValue.toLowerCase()

    const filteredUsers = this.data.users.filter(user => {
      let searchText = ''
      switch (searchType) {
        case 'username':
          searchText = user.username.toLowerCase()
          break
        case 'company':
          searchText = (user.company_name || '').toLowerCase()
          break
        case 'contact':
          searchText = (user.contact_info || '').toLowerCase()
          break
      }
      return searchText.includes(searchValue)
    })

    this.setData({
      users: filteredUsers
    })
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
        is_admin: false
      }
    })
  },

  editUser(e) {
    const user = e.currentTarget.dataset.user
    this.setData({
      showEditModal: true,
      modalTitle: '编辑用户信息',
      showPassword: false,
      editUser: Object.assign({}, user)
    })
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editUser: null,
      showPassword: false
    })
  },

  togglePassword(e) {
    console.log('切换密码显示状态', this.data.showPassword, '→', !this.data.showPassword)
    this.setData({
      showPassword: !this.data.showPassword
    })
    
  },
  

  submitEdit(e) {
    const formData = e.detail.value
    const userId = formData.id

    // 构建请求数据
    const requestData = {
      username: formData.username,
      company_name: formData.company_name,
      contact_info: formData.contact_info,
      is_admin: formData.is_admin === 'true' || formData.is_admin === true
    }

    // 如果是新增用户或密码不为空，则添加到请求数据中
    if (!userId || formData.password) {
      requestData.password = formData.password
    }

    // 根据是否有userId判断是新增还是编辑
    const url = userId ? 
      `${app.globalData.baseUrl}/api/v1/admin/users/${userId}` :
      `${app.globalData.baseUrl}/api/v1/admin/users`
    const method = userId ? 'PUT' : 'POST'

    wx.request({
      url: url,
      method: method,
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`,
        'Content-Type': 'application/json'
      },
      data: requestData,
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          wx.showToast({
            title: userId ? '更新成功' : '添加成功',
            icon: 'success'
          })
          this.closeEditModal()
          this.loadUsers()
        } else {
          wx.showToast({
            title: res.data.error || '操作失败',
            icon: 'error'
          })
        }
      },
      fail: (err) => {
        console.error('操作失败:', err)
        wx.showToast({
          title: '操作失败',
          icon: 'error'
        })
      }
    })
  },

  deleteUser(e) {
    const userId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此用户吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.baseUrl}/api/v1/admin/users/${userId}`,
            method: 'DELETE',
            header: {
              'Authorization': `Bearer ${wx.getStorageSync('token')}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                })
                this.loadUsers()
              }
            },
            fail: (err) => {
              console.error('删除用户失败:', err)
              wx.showToast({
                title: '删除失败',
                icon: 'error'
              })
            }
          })
        }
      }
    })
  }
})