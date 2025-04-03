// pages/admin/user/detail.js
const app = getApp();

Page({
  data: {
    userId: null,
    userInfo: {},
    loading: true,
    addressCache: {}, // 地址解析结果缓存
    defaultLocation: {lat: 34.746, lng: 113.625} // 默认位置（可根据实际情况调整）
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        userId: options.id
      });
      this.loadUserDetail(options.id);
      // 加载缓存的地址解析结果
      this.loadAddressCache();
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

  // 从本地存储加载地址缓存
  loadAddressCache() {
    try {
      const cache = wx.getStorageSync('addressCache');
      if (cache) {
        this.setData({
          addressCache: JSON.parse(cache)
        });
      }
    } catch (e) {
      console.error('加载地址缓存失败:', e);
    }
  },

  // 保存地址缓存到本地存储
  saveAddressCache() {
    try {
      wx.setStorageSync('addressCache', JSON.stringify(this.data.addressCache));
    } catch (e) {
      console.error('保存地址缓存失败:', e);
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

  // 打开地图位置并导航 - 简化版本
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
      this.openWxMapNavigation(
        this.data.addressCache[cacheKey], 
        address,
        companyName
      );
      return;
    }
    
    wx.showLoading({ title: '获取位置中...' });
    
    // 实现智能降级搜索策略
    this.findLocationWithFallback(address, companyName)
      .then(location => {
        wx.hideLoading();
        
        // 缓存结果
        const addressCache = this.data.addressCache;
        addressCache[cacheKey] = location;
        this.setData({ addressCache });
        this.saveAddressCache(); // 持久化保存缓存
        
        // 直接使用微信内置导航
        this.openWxMapNavigation(location, address, companyName);
      })
      .catch(error => {
        wx.hideLoading();
        console.error('地址解析失败:', error);
                this.openWxMapNavigation(
                  this.data.defaultLocation,
                  address,
                  companyName
                );
              
        
        // 所有方法都失败后的兜底方案
        // wx.showModal({
        //   title: '地址解析失败',
        //   content: '无法获取准确位置，是否使用默认位置导航？',
        //   success: (res) => {
        //     if (res.confirm) {
        //       this.openWxMapNavigation(
        //         this.data.defaultLocation,
        //         address,
        //         companyName
        //       );
        //     }
        //   }
        // });
      });
  },

  // 智能降级位置搜索策略
  findLocationWithFallback(address, companyName) {
    return new Promise((resolve, reject) => {
      // 步骤1: 公司名称+地址组合搜索
      if (companyName) {
        this.searchByCompanyAndAddress(companyName, address)
          .then(resolve)
          .catch(() => {
            console.log('公司名称+地址搜索失败，尝试仅使用公司名称');
            
            // 步骤2: 仅用公司名称搜索
            this.searchByCompanyName(companyName)
              .then(resolve)
              .catch(() => {
                console.log('公司名称搜索失败，尝试仅使用地址');
                
                // 步骤3: 仅用地址搜索
                this.searchByAddress(address)
                  .then(resolve)
                  .catch(reject);
              });
          });
      } else {
        // 如果没有公司名称，直接用地址搜索
        this.searchByAddress(address)
          .then(resolve)
          .catch(reject);
      }
    });
  },

  // 使用公司名称+地址搜索
  searchByCompanyAndAddress(company, address) {
    return new Promise((resolve, reject) => {
      // 先尝试POI搜索（更精确）
      app.globalData.qqmapsdk.search({
        keyword: `${company} ${address}`,
        success: res => {
          if (res.status === 0 && res.data.length > 0) {
            console.log('POI搜索成功:', res.data[0]);
            resolve(res.data[0].location);
          } else {
            // 回退到地理编码
            app.geocoder(`${company} ${address}`)
              .then(result => resolve(result.location))
              .catch(reject);
          }
        },
        fail: () => {
          // 回退到地理编码
          app.geocoder(`${company} ${address}`)
            .then(result => resolve(result.location))
            .catch(reject);
        }
      });
    });
  },

  // 仅用公司名称搜索
  searchByCompanyName(company) {
    return new Promise((resolve, reject) => {
      app.globalData.qqmapsdk.search({
        keyword: company,
        success: res => {
          if (res.status === 0 && res.data.length > 0) {
            console.log('公司名称搜索成功:', res.data[0]);
            resolve(res.data[0].location);
          } else {
            reject(new Error('公司名称搜索失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 仅用地址搜索
  searchByAddress(address) {
    return new Promise((resolve, reject) => {
      app.geocoder(address)
        .then(result => {
          console.log('地址搜索成功:', result);
          resolve(result.location);
        })
        .catch(reject);
    });
  },

  // 微信内置地图导航
  openWxMapNavigation(location, address, companyName) {
    wx.openLocation({
      latitude: location.lat,
      longitude: location.lng,
      name: companyName || '企业位置',
      address: address,
      scale: 18
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