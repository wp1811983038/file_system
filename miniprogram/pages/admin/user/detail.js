const app = getApp()

Page({
  data: {
    userId: null,
    userInfo: {},
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        userId: options.id
      })
      this.loadUserDetail(options.id)
    } else {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  loadUserDetail(userId) {
    wx.showLoading({ title: '加载中...' })

    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/admin/users/${userId}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 处理头像URL
          let userData = res.data
          
          // 确保头像URL正确
          if (userData.avatar_url && userData.avatar_url.startsWith('/static/')) {
            userData.avatar_url = app.globalData.baseUrl + userData.avatar_url
          } else if (!userData.avatar_url) {
            userData.avatar_url = '/images/default-avatar.png'
          }
          
          // 格式化日期
          if (userData.created_at) {
            const date = new Date(userData.created_at)
            userData.created_at = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          }
          
          this.setData({
            userInfo: userData,
            loading: false
          })
        } else {
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('加载用户详情失败:', err)
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      },
      complete: () => {
        wx.hideLoading()
        this.setData({ loading: false })
      }
    })
  },

  // 直接拨打电话
  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) {
      wx.showToast({
        title: '电话号码不存在',
        icon: 'none'
      })
      return
    }
    
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        if (err.errMsg !== "makePhoneCall:fail cancel") {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 打开地图位置
  openLocation(e) {
    const address = e.currentTarget.dataset.address
    if (!address) {
      wx.showToast({
        title: '地址不存在',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({ title: '获取位置中...' })
    
    // 在实际项目中，此处应调用地图API将地址转换为经纬度
    // 这里使用示例坐标，实际开发中应替换为真实坐标获取逻辑
    setTimeout(() => {
      wx.hideLoading()
      
      // 示例坐标，实际应该通过地址解析获取
      wx.openLocation({
        latitude: 34.746,
        longitude: 113.625,
        name: this.data.userInfo.company_name || '企业位置',
        address: address,
        scale: 18
      })
    }, 500)
  },

  // 编辑用户
  editUser() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]  // 获取上一页面
    
    if (prevPage && prevPage.route.includes('/admin/user/list')) {
      prevPage.editUser({
        currentTarget: {
          dataset: {
            user: this.data.userInfo
          }
        }
      })
      wx.navigateBack()
    } else {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 删除用户
  deleteUser() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此用户吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          
          wx.request({
            url: `${app.globalData.baseUrl}/api/v1/admin/users/${this.data.userId}`,
            method: 'DELETE',
            header: {
              'Authorization': `Bearer ${wx.getStorageSync('token')}`
            },
            success: (res) => {
              wx.hideLoading()
              
              if (res.statusCode === 200) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                })
                
                // 返回上一页并刷新列表
                const pages = getCurrentPages()
                const prevPage = pages[pages.length - 2]
                
                if (prevPage && prevPage.route.includes('/admin/user/list')) {
                  // 刷新上一页数据
                  prevPage.loadUsers()
                }
                
                setTimeout(() => {
                  wx.navigateBack()
                }, 1500)
              } else {
                wx.showToast({
                  title: res.data && res.data.error ? res.data.error : '删除失败',
                  icon: 'none'
                })
              }
            },
            fail: (err) => {
              wx.hideLoading()
              console.error('删除用户失败:', err)
              
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  }
})