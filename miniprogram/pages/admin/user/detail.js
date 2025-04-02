const app = getApp()

Page({
  data: {
    userId: null,
    userInfo: {}
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

    // 使用新的API端点直接获取单个用户数据
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
          if (userData.avatar_url && userData.avatar_url.startsWith('/static/')) {
            userData.avatar_url = app.globalData.baseUrl + userData.avatar_url
          }
          
          // 格式化日期
          if (userData.created_at) {
            const date = new Date(userData.created_at)
            userData.created_at = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          }
          
          this.setData({
            userInfo: userData
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
      }
    })
  },

  // 其他方法保持不变...
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
      success: () => {
        console.log('拨打电话成功')
      },
      fail: (err) => {
        console.error('拨打电话失败:', err)
        if (err.errMsg !== "makePhoneCall:fail cancel") {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          })
        }
      }
    })
  },

  openLocation(e) {
    const address = e.currentTarget.dataset.address
    if (!address) {
      wx.showToast({
        title: '地址不存在',
        icon: 'none'
      })
      return
    }
    
    // 地址转坐标需要使用地图API，这里模拟一个位置
    // 实际项目中应该使用地图服务API进行地址解析
    wx.showActionSheet({
      itemList: ['打开位置', '导航到此地'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 微信内置地图打开位置
          this.openLocationInWx(address)
        } else if (res.tapIndex === 1) {
          // 选择导航应用
          this.chooseNavigationApp(address)
        }
      }
    })
  },
  
  openLocationInWx(address) {
    // 实际项目中需要调用地图API将地址转换为经纬度
    // 这里使用一个默认位置，示例目的
    wx.showLoading({ title: '获取位置中...' })
    
    // 模拟获取坐标的过程
    setTimeout(() => {
      wx.hideLoading()
      
      // 实际项目中，下面的经纬度应该是通过地图API获取的
      wx.openLocation({
        latitude: 34.746,  // 示例坐标，实际应根据地址获取
        longitude: 113.625,  // 示例坐标，实际应根据地址获取
        name: this.data.userInfo.company_name || '企业位置',
        address: address,
        scale: 18
      })
    }, 1000)
  },
  
  chooseNavigationApp(address) {
    // 选择导航应用
    wx.showActionSheet({
      itemList: ['高德地图', '腾讯地图', '百度地图'],
      success: (res) => {
        const apps = ['amap', 'qqmap', 'baidumap']
        const selectedApp = apps[res.tapIndex]
        this.openNavigationApp(selectedApp, address)
      }
    })
  },
  
  openNavigationApp(appType, address) {
    // 示例目的，使用固定坐标
    // 实际项目中应从地图API获取经纬度
    const latitude = 34.746
    const longitude = 113.625
    const name = this.data.userInfo.company_name || '企业位置'
    
    // 构建不同导航应用的URL Scheme
    let url = ''
    switch (appType) {
      case 'amap':  // 高德地图
        url = `androidamap://viewMap?sourceApplication=appname&poiname=${encodeURIComponent(name)}&lat=${latitude}&lon=${longitude}&dev=0`
        break
      case 'qqmap':  // 腾讯地图
        url = `qqmap://map/geocoder?coord=${latitude},${longitude}&referer=myapp`
        break
      case 'baidumap':  // 百度地图
        url = `baidumap://map/marker?location=${latitude},${longitude}&title=${encodeURIComponent(name)}&coord_type=gcj02&src=andr.baidu.openAPIdemo`
        break
    }
    
    // 尝试打开应用
    wx.showLoading({ title: '打开导航...' })
    
    // 使用openURL打开第三方应用
    wx.navigateToMiniProgram({
      appId: '',  // 这里是为了触发fail回调，实际不会执行成功
      path: url,
      extraData: {},
      success: () => {
        wx.hideLoading()
      },
      fail: () => {
        wx.hideLoading()
        wx.showModal({
          title: '提示',
          content: `未安装对应的导航应用，请先安装${appType === 'amap' ? '高德地图' : (appType === 'qqmap' ? '腾讯地图' : '百度地图')}`,
          showCancel: false
        })
      }
    })
  },

  editUser() {
    // 跳回用户列表页并触发编辑模态框
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