// pages/admin/settings/index.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    systemSettings: {
      system_name: '',
      system_description: ''
    },
    avatarTimestamp: new Date().getTime() // 添加时间戳防止缓存
  },

  onLoad() {
    this.loadUserInfo()
    this.loadSettings()
  },

  onShow() {
    // 设置TabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 3  // 设置
      })
    }
  },

  onPullDownRefresh() {
    Promise.all([
      this.loadUserInfo(),
      this.loadSettings()
    ]).then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载用户信息
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

  // 加载系统设置
  async loadSettings() {
    try {
      const token = wx.getStorageSync('token')
      if (!token) {
        wx.redirectTo({ url: '/pages/login/login' })
        return
      }

      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.baseUrl}/api/v1/admin/settings`,
          method: 'GET',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200) {
        this.setData({ 
          systemSettings: res.data
        })
      } else {
        throw new Error('获取系统设置失败')
      }
    } catch (err) {
      console.error('加载系统设置失败:', err)
      wx.showToast({
        title: '获取设置失败',
        icon: 'none'
      })
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

  // 裁剪图片
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

  // 上传头像到服务器
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
    
    // 上传文件
    wx.uploadFile({
      url: `${app.globalData.baseUrl}/api/v1/users/avatar`,
      filePath: filePath,
      name: 'avatar',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        let response
        try {
          response = JSON.parse(res.data)
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
            if (!avatarUrl.startsWith('/')) {
              avatarUrl = '/' + avatarUrl
            }
            avatarUrl = app.globalData.baseUrl + avatarUrl
          }
          
          // 更新头像URL和时间戳
          this.setData({
            'userInfo.avatar_url': avatarUrl,
            'avatarTimestamp': new Date().getTime() // 更新时间戳防止缓存
          })
          
          // 保存头像URL到本地存储，防止刷新丢失
          wx.setStorageSync('userAvatarUrl', avatarUrl)
          
          // 振动反馈
          wx.vibrateShort({ type: 'light' })
          
          wx.showToast({
            title: '头像更新成功',
            icon: 'success'
          })
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

  // 显示头像操作选项
  showAvatarOptions() {
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
          
          wx.showToast({
            title: '已恢复默认头像',
            icon: 'success'
          })
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
  }
})