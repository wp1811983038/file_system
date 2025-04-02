// pages/user/profile/list.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    isUserInfoExpanded: false,
    showSuccessTip: false,
    successMessage: '',
    avatarTimestamp: new Date().getTime() // 添加时间戳防止缓存
  },

  onLoad() {
    this.loadUserInfo()
  },

  onShow() {
    console.log('个人中心页面显示')
    // 确保正确设置TabBar的选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1  // 个人中心的索引
      })
    }
    
    // 重新加载用户信息，确保数据最新
    this.loadUserInfo()
  },

  onPullDownRefresh() {
    this.loadUserInfo().then(() => {
      wx.stopPullDownRefresh()
    })
  },
  
  // 切换用户信息展开/折叠状态
  toggleUserInfoExpand() {
    this.setData({
      isUserInfoExpanded: !this.data.isUserInfoExpanded
    })
    
    // 添加触感反馈
    wx.vibrateShort({ type: 'light' })
  },

  // 跳转到编辑个人资料页面
  navigateToEditProfile() {
    wx.navigateTo({
      url: '/pages/user/profile/edit',
    })
  },

  // 跳转到修改密码页面
  navigateToChangePassword() {
    wx.navigateTo({
      url: '/pages/user/password/list',
    })
  },
  
  // 处理退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除存储的登录信息
          wx.clearStorageSync()
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login',
          })
        }
      }
    })
  },

  // 显示成功提示
  showSuccess(message) {
    this.setData({
      showSuccessTip: true,
      successMessage: message
    })
    
    // 2秒后自动隐藏
    setTimeout(() => {
      this.setData({
        showSuccessTip: false
      })
    }, 2000)
  },

  // 加载用户信息 - 修复版本
// 修改加载用户信息的函数
async loadUserInfo() {
  try {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }

    const res = await new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}/api/v1/users/profile`,
        method: 'GET',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: resolve,
        fail: reject
      })
    })

    console.log('用户信息响应:', res)
    
    if (res.statusCode === 200) {
      // 处理头像URL
      let profileData = {...res.data}
      
      // 如果服务器返回的头像URL有效，添加服务器基础URL
      if (profileData.avatar_url && profileData.avatar_url.startsWith('/static/')) {
        profileData.avatar_url = app.globalData.baseUrl + profileData.avatar_url
        
        // 存储头像URL到本地缓存
        wx.setStorageSync('userAvatarUrl', profileData.avatar_url)
      } else {
        // 如果没有有效头像，尝试从本地缓存读取
        const cachedAvatarUrl = wx.getStorageSync('userAvatarUrl')
        if (cachedAvatarUrl) {
          profileData.avatar_url = cachedAvatarUrl
        } else {
          // 使用null表示没有自定义头像，WXML中将使用本地默认头像
          profileData.avatar_url = null
        }
      }
      
      // 更新用户信息
      this.setData({ 
        userInfo: profileData,
        avatarTimestamp: new Date().getTime()
      })
    } else {
      throw new Error('获取用户信息失败')
    }
  } catch (err) {
    console.error('加载用户信息失败:', err)
    wx.showToast({
      title: '获取信息失败',
      icon: 'none'
    })
  }
},

  // 单独加载头像API
  async loadAvatar() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) return

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/avatar`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200 && res.data.avatar_url) {
        let avatarUrl = res.data.avatar_url
        // 更新用户头像
        this.setData({
          'userInfo.avatar_url': avatarUrl,
          'avatarTimestamp': new Date().getTime()
        })
      }
    } catch (err) {
      console.error('加载头像失败:', err)
    }
  },

  // 选择并上传头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'front',
      success: (res) => {
        // 获取选择的图片
        const tempFilePath = res.tempFiles[0].tempFilePath
        
        // 裁剪图片（如果微信支持）
        this.cropAvatar(tempFilePath)
      }
    })
  },

  // 裁剪图片，如果设备支持
  cropAvatar(filePath) {
    // 检查是否支持图片编辑器
    if (wx.editImage) {
      wx.editImage({
        src: filePath,
        success: (res) => {
          // 上传裁剪后的图片
          this.uploadAvatar(res.tempFilePath)
        },
        fail: () => {
          // 如果编辑失败，直接上传原图
          this.uploadAvatar(filePath)
        }
      })
    } else {
      // 不支持编辑器，直接上传
      this.uploadAvatar(filePath)
    }
  },

  // 上传头像到服务器 - 修复版本
  uploadAvatar(filePath) {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({
        title: '登录已过期',
        icon: 'none'
      })
      return
    }

    // 显示加载中
    wx.showLoading({
      title: '上传中...',
    })

    console.log('开始上传头像...')
    
    // 上传文件
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/v1/users/avatar`,
      filePath: filePath,
      name: 'avatar',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        console.log('上传头像响应:', res)
        
        let response
        try {
          response = JSON.parse(res.data)
          console.log('解析后的响应:', response)
        } catch (e) {
          console.error('解析响应失败:', e)
          response = res.data
        }

        if (res.statusCode === 200) {
          // 处理头像URL，确保格式正确
          let avatarUrl = response.avatar_url
          
          // 移除可能的时间戳参数
          avatarUrl = avatarUrl.split('?')[0]
          
          // 添加完整路径（如果需要）
          if (!avatarUrl.startsWith('http')) {
            // 如果是相对路径且不以/开头，添加/
            if (!avatarUrl.startsWith('/')) {
              avatarUrl = '/' + avatarUrl
            }
            avatarUrl = app.globalData.baseUrl + avatarUrl
          }
          
          console.log('处理后的头像URL:', avatarUrl)
          
          // 更新头像URL和时间戳
          this.setData({
            'userInfo.avatar_url': avatarUrl,
            'avatarTimestamp': new Date().getTime() // 更新时间戳防止缓存
          })
          
          // 保存头像URL到本地存储，防止刷新丢失
          wx.setStorageSync('userAvatarUrl', avatarUrl)
          
          // 振动反馈
          wx.vibrateShort({ type: 'light' })
          
          // 显示成功提示
          this.showSuccess('头像更新成功')
        } else {
          wx.showToast({
            title: response.error || '上传失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('上传头像失败:', err)
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  // 长按头像弹出菜单
  longPressAvatar() {
    // 判断是否使用默认头像
    const isDefaultAvatar = this.data.userInfo.avatar_url && 
                           this.data.userInfo.avatar_url.includes('default-avatar')
                           
    if (isDefaultAvatar) {
      return // 已经是默认头像，不需要操作
    }
    
    // 弹出操作菜单
    wx.showActionSheet({
      itemList: ['更换头像', '恢复默认头像'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 更换头像
          this.chooseAvatar()
        } else if (res.tapIndex === 1) {
          // 恢复默认头像
          this.resetToDefaultAvatar()
        }
      }
    })
  },

  // 恢复默认头像
  resetToDefaultAvatar() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({
        title: '登录已过期',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({ title: '处理中...' })
    
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/users/avatar`,
      method: 'DELETE',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 更新头像为默认头像
          this.setData({
            'userInfo.avatar_url': app.globalData.baseUrl + '/static/images/default-avatar.png',
            'avatarTimestamp': new Date().getTime()
          })
          
          // 清除本地存储的头像URL
          wx.removeStorageSync('userAvatarUrl')
          
          this.showSuccess('已恢复默认头像')
        } else {
          wx.showToast({
            title: res.data.error || '操作失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('恢复默认头像失败:', err)
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  // 跳转到通知设置页面
  goToNotificationSettings() {
    // 直接请求订阅消息
    this.requestSubscription()
  },

  // 请求订阅消息权限
  requestSubscription() {
    wx.requestSubscribeMessage({
      tmplIds: [
        '', // 收到文件通知模板ID
        ''  // 文件处理结果通知模板ID
      ],
      success: (res) => {
        // 获取订阅结果
        const subscribeStatus = {
          fileReceiveStatus: res[''],
          fileProcessStatus: res['']
        };
      
      
        // 将订阅状态提交到后端保存
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/users/subscribe`,
          method: 'POST',
          data: subscribeStatus,
          header: {
            'Authorization': `Bearer ${wx.getStorageSync('token')}`
          },
          success: (res) => {
            if (res.statusCode === 200) {
              this.showSuccess('通知设置已更新')
              
              // 查询当前状态并显示结果
              this.getSubscriptionStatus()
            }
          },
          fail: (err) => {
            console.error('保存订阅状态失败:', err)
            wx.showToast({
              title: '设置保存失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('请求订阅消息失败:', err)
        wx.showToast({
          title: '请允许接收通知',
          icon: 'none'
        })
      }
    })
  },
  
  // 获取当前订阅状态
  getSubscriptionStatus() {
    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/users/subscribe`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 这里可以显示当前订阅状态
          const status = res.data
          const tipMessage = `文件通知: ${status.fileReceiveStatus === 'accept' ? '已订阅' : '未订阅'}\n审核通知: ${status.fileProcessStatus === 'accept' ? '已订阅' : '未订阅'}`
          
          wx.showModal({
            title: '当前通知设置',
            content: tipMessage,
            showCancel: false
          })
        }
      }
    })
  }
})