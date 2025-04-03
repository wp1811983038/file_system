const app = getApp();

Page({
  data: {
    userId: null,
    userInfo: {},
    loading: true,
    addressCache: {} // 地址解析结果缓存
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        userId: options.id
      });
      this.loadUserDetail(options.id);
    } else {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  loadUserDetail(userId) {
    wx.showLoading({ title: '加载中...' });

    wx.request({
      url: `${app.globalData.baseUrl}/api/v1/admin/users/${userId}`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${wx.getStorageSync('token')}`
      },
      success: (res) => {
        if (res.statusCode === 200) {
          // 处理头像URL
          let userData = res.data;
          
          // 确保头像URL正确
          if (userData.avatar_url && userData.avatar_url.startsWith('/static/')) {
            userData.avatar_url = app.globalData.baseUrl + userData.avatar_url;
          } else if (!userData.avatar_url) {
            userData.avatar_url = '/images/default-avatar.png';
          }
          
          this.setData({
            userInfo: userData,
            loading: false
          });
        } else {
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('加载用户详情失败:', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ loading: false });
      }
    });
  },

  // 直接拨打电话
  makePhoneCall(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) {
      wx.showToast({
        title: '电话号码不存在',
        icon: 'none'
      });
      return;
    }
    
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        if (err.errMsg !== "makePhoneCall:fail cancel") {
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 打开地图位置并导航
// 在detail.js中修改openLocation方法
openLocation(e) {
  const address = e.currentTarget.dataset.address;
  const companyName = this.data.userInfo.company_name;
  
  if (!address) {
    wx.showToast({
      title: '地址不存在',
      icon: 'none'
    });
    return;
  }
  
  // 生成缓存键，包含公司名称和地址
  const cacheKey = `${companyName}:${address}`;
  
  // 检查缓存中是否已有解析结果
  if (this.data.addressCache[cacheKey]) {
    this.showNavigationOptions(
      this.data.addressCache[cacheKey], 
      address,
      companyName
    );
    return;
  }
  
  wx.showLoading({ title: '获取位置中...' });
  
  // 调用改进的地址解析服务，传入公司名称
  app.geocoder(address, companyName).then(result => {
    wx.hideLoading();
    
    // 缓存结果
    const addressCache = this.data.addressCache;
    addressCache[cacheKey] = result.location;
    this.setData({ addressCache });
    
    // 显示导航选项，传入公司名称用于导航显示
    this.showNavigationOptions(result.location, address, companyName);
  }).catch(error => {
    wx.hideLoading();
    console.error('地址解析失败:', error);
    
    // 提供备选方案
    wx.showModal({
      title: '地址解析失败',
      content: '无法获取准确位置，是否尝试使用公司名称搜索？',
      success: (res) => {
        if (res.confirm) {
          // 使用微信内置地图的搜索功能
          wx.openLocation({
            latitude: 34.746,
            longitude: 113.625,
            name: companyName || '企业位置',
            address: address,
            scale: 18
          });
        }
      }
    });
  });
},

// 修改导航方法，使用公司名称增强显示
openWxMapNavigation(location, address, companyName) {
  wx.openLocation({
    latitude: location.lat,
    longitude: location.lng,
    name: companyName || '企业位置',
    address: address,
    scale: 18
  });
},

  // 打开高德地图导航
  openAmapNavigation(location, address) {
    let url = `androidamap://navi?sourceApplication=${app.globalData.appName || '文件管理系统'}&lat=${location.lat}&lon=${location.lng}&dev=0&style=2`;
    
    // 尝试打开高德地图应用
    wx.showModal({
      title: '打开高德地图',
      content: '即将跳转到高德地图进行导航，是否继续？',
      success: (res) => {
        if (res.confirm) {
          // 通过设置Clipboard方式间接打开外部应用
          wx.setClipboardData({
            data: url,
            success: () => {
              wx.showToast({
                title: '链接已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  // 打开百度地图导航
  openBmapNavigation(location, address) {
    // 这里应该添加坐标转换，将GCJ-02转为BD-09
    // 简化实现，实际项目中使用坐标转换函数
    let url = `baidumap://map/direction?destination=${location.lat},${location.lng}&coord_type=gcj02&mode=driving&src=${app.globalData.appName || '文件管理系统'}`;
    
    wx.showModal({
      title: '打开百度地图',
      content: '即将跳转到百度地图进行导航，是否继续？',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: url,
            success: () => {
              wx.showToast({
                title: '链接已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  // 编辑用户
  editUser() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    
    if (prevPage && prevPage.route.includes('/admin/user/list')) {
      prevPage.editUser({
        currentTarget: {
          dataset: {
            user: this.data.userInfo
          }
        }
      });
      wx.navigateBack();
    } else {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 删除用户
  deleteUser() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此用户吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          
          wx.request({
            url: `${app.globalData.baseUrl}/api/v1/admin/users/${this.data.userId}`,
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
                
                // 返回上一页并刷新列表
                const pages = getCurrentPages();
                const prevPage = pages[pages.length - 2];
                
                if (prevPage && prevPage.route.includes('/admin/user/list')) {
                  // 刷新上一页数据
                  prevPage.loadUsers();
                }
                
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
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
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
});