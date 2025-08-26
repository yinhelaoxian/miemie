// miniprogram/pages/index/index.js

Page({
  data: {
    showCropper: false, // 是否显示裁剪界面
    originalPath: '', // 原始图片路径
    cropperWidth: 300, // 默认裁剪框宽度（动态设置）
    cropperHeight: 169, // 默认裁剪框高度（动态设置）
    thumbnail: '', // 压缩后图片的临时路径
    compressedPath: '' // 压缩后的临时路径
  },

  onLoad: function () {
    // 延迟初始化组件
    setTimeout(() => {
      this.initCropper();
    }, 1500); // 增加延迟至1.5秒
  },

  onReady: function () {
    // 再次尝试初始化组件
    if (!this.cropper) {
      this.initCropper();
    }
  },

  // 初始化裁剪组件
  initCropper: function () {
    this.cropper = this.selectComponent("#image-cropper");
    if (!this.cropper) {
      console.error('裁剪组件初始化失败');
      wx.showToast({ title: '裁剪组件加载失败，请检查配置', icon: 'none', duration: 3000 });
    } else {
      console.log('裁剪组件初始化成功');
    }
  },

  // 拍照功能
  takePhoto: function () {
    const that = this;

    // 检查摄像头权限
    wx.authorize({
      scope: 'scope.camera',
      success() {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera'],
          camera: 'back',
          success: (res) => {
            const originalPath = res.tempFiles[0].tempFilePath;
            console.log('拍照成功，原图路径:', originalPath);

            // 验证图片路径
            wx.getFileSystemManager().access({
              path: originalPath,
              success: () => {
                // 获取原始图片信息，设置裁剪框
                wx.getImageInfo({
                  src: originalPath,
                  success: (info) => {
                    console.log('原始图片信息:', info);
                    const defaultWidth = info.width; // 使用原始宽度
                    const defaultHeight = Math.floor(defaultWidth * (9 / 16)); // 按16:9计算高度
                    that.setData({
                      showCropper: true,
                      originalPath: originalPath,
                      cropperWidth: defaultWidth,
                      cropperHeight: defaultHeight
                    });
                    wx.showToast({ title: '请调整裁剪框后确认（默认16:9）', icon: 'none' });
                    // 再次尝试初始化组件
                    if (!that.cropper) {
                      that.initCropper();
                    }
                  },
                  fail: (err) => {
                    console.error('获取图片信息失败:', err);
                    wx.showToast({ title: '获取图片信息失败，请重试', icon: 'none' });
                  }
                });
              },
              fail: (err) => {
                console.error('图片路径无效:', err);
                wx.showToast({ title: '图片路径无效，请重新拍照', icon: 'none' });
              }
            });
          },
          fail: (err) => {
            if (err.errMsg.includes('cancel')) {
              wx.showToast({ title: '已取消拍照', icon: 'none' });
            } else {
              wx.showToast({ title: '拍照失败，请重试', icon: 'none' });
              console.error('拍照失败:', err);
            }
          }
        });
      },
      fail() {
        wx.showToast({ title: '请先授权摄像头权限', icon: 'none' });
        setTimeout(() => {
          wx.openSetting({
            success: (settingRes) => {
              if (!settingRes.authSetting['scope.camera']) {
                wx.showToast({ title: '未授权摄像头，无法拍照', icon: 'none' });
              }
            }
          });
        }, 1500);
      }
    });
  },

  // 裁剪组件加载完成
  cropperload: function (e) {
    console.log('裁剪组件加载完成:', e);
    // 再次尝试初始化
    if (!this.cropper) {
      this.initCropper();
    }
  },

  // 图片加载到裁剪组件
  loadimage: function (e) {
    console.log('图片加载完成:', e.detail);
    wx.hideLoading();
    if (this.cropper) {
      this.cropper.imgReset();
    } else {
      console.error('裁剪组件未初始化');
      wx.showToast({ title: '裁剪组件未初始化，将直接压缩', icon: 'none', duration: 3000 });
      this.compressWithFallback(this.data.originalPath);
    }
  },

  // 确认裁剪
  confirmCrop: function () {
    const that = this;
    console.log('触发确认裁剪');
    if (!this.cropper) {
      console.error('裁剪组件未初始化');
      wx.showToast({ title: '裁剪组件未初始化，将直接压缩', icon: 'none', duration: 3000 });
      this.compressWithFallback(this.data.originalPath);
      return;
    }

    wx.showLoading({ title: '正在裁剪...', mask: true });
    this.cropper.getImg((res) => {
      wx.hideLoading();
      if (res.url) {
        const croppedPath = res.url;
        console.log('裁剪后图片路径:', croppedPath);

        // 验证裁剪图片尺寸
        wx.getImageInfo({
          src: croppedPath,
          success: (info) => {
            console.log('裁剪图片信息:', info);
            const aspectRatio = info.width / info.height;
            if (Math.abs(aspectRatio - 1.777) > 0.2) {
              console.warn('裁剪图片比例非16:9:', info.width, info.height);
              wx.showToast({ title: '裁剪比例非16:9，继续压缩', icon: 'none' });
            }

            // 压缩裁剪后的图片
            wx.compressImage({
              src: croppedPath,
              quality: 50, // 提高质量避免全黑
              success: (compressRes) => {
                const compressedPath = compressRes.tempFilePath;
                console.log('压缩成功，压缩路径:', compressedPath);

                // 验证压缩后图片
                wx.getImageInfo({
                  src: compressedPath,
                  success: (compressInfo) => {
                    console.log('压缩图片信息:', compressInfo);
                    that.setData({
                      thumbnail: compressedPath,
                      compressedPath: compressedPath,
                      showCropper: false
                    });
                    wx.showToast({ title: '裁剪压缩成功', icon: 'success' });
                  },
                  fail: (err) => {
                    console.error('获取压缩图片信息失败:', err);
                    wx.showToast({ title: '获取压缩图片信息失败，请重试', icon: 'none' });
                  }
                });
              },
              fail: (err) => {
                console.error('压缩失败:', err);
                wx.showToast({ title: '图片压缩失败，请重试', icon: 'none' });
              }
            });
          },
          fail: (err) => {
            console.error('获取裁剪图片信息失败:', err);
            wx.showToast({ title: '获取裁剪图片信息失败，请重试', icon: 'none' });
          }
        });
      } else {
        console.error('裁剪失败:', res);
        wx.showToast({ title: '裁剪失败，将直接压缩', icon: 'none' });
        this.compressWithFallback(this.data.originalPath);
      }
    });
  },

  // 回退压缩方案（无裁剪）
  compressWithFallback: function (originalPath) {
    const that = this;
    wx.compressImage({
      src: originalPath,
      quality: 50, // 保持清晰度
      success: (compressRes) => {
        const compressedPath = compressRes.tempFilePath;
        console.log('回退压缩成功，压缩路径:', compressedPath);
        that.setData({
          thumbnail: compressedPath,
          compressedPath: compressedPath,
          showCropper: false
        });
        wx.showToast({ title: '图片压缩成功（未裁剪）', icon: 'success' });
      },
      fail: (err) => {
        console.error('回退压缩失败:', err);
        wx.showToast({ title: '图片压缩失败，请重试', icon: 'none' });
      }
    });
  },

  // 预览图片
  previewImage: function () {
    const { thumbnail } = this.data;
    if (!thumbnail) {
      wx.showToast({ title: '无图片可预览', icon: 'none' });
      return;
    }

    wx.previewImage({
      current: thumbnail,
      urls: [thumbnail],
      success: () => {
        console.log('图片预览成功');
      },
      fail: (err) => {
        console.error('预览图片失败:', err);
        wx.showToast({ title: '预览图片失败', icon: 'none' });
      }
    });
  },

  // 上传到云存储（添加用户验证）
  uploadToCloud: function () {
    const { compressedPath } = this.data;
    if (!compressedPath) {
      wx.showToast({ title: '无图片可上传', icon: 'none' });
      return;
    }

    // 检查云开发初始化
    if (!wx.cloud) {
      console.error('云开发未初始化');
      wx.showToast({ title: '云开发未初始化，请检查配置', icon: 'none', duration: 3000 });
      return;
    }

    // 检查用户登录状态
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userInfo']) {
          wx.showToast({ title: '请先登录以上传图片', icon: 'none' });
          wx.navigateTo({ url: '/pages/login/index' }); // 假设有登录页面
          return;
        }

        // 检查网络状态
        wx.getNetworkType({
          success: (res) => {
            if (res.networkType === 'none') {
              wx.showToast({ title: '无网络连接，请检查网络', icon: 'none' });
              return;
            }

            // 检查文件是否存在
            wx.getFileSystemManager().access({
              path: compressedPath,
              success: () => {
                wx.showLoading({ title: '正在上传...', mask: true });
                wx.cloud.uploadFile({
                  cloudPath: `wrong-questions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
                  filePath: compressedPath,
                  success: (uploadRes) => {
                    wx.hideLoading();
                    console.log('上传成功，云文件ID:', uploadRes.fileID);
                    wx.showToast({ title: '已成功存储到云端服务器', icon: 'success' });
                    this.setData({
                      thumbnail: '',
                      compressedPath: ''
                    });
                  },
                  fail: (err) => {
                    wx.hideLoading();
                    console.error('上传云存储失败:', err);
                    if (err.errMsg.includes('INVALID_ENV')) {
                      wx.showToast({ title: '云环境ID无效，请检查配置', icon: 'none', duration: 3000 });
                    } else if (err.errMsg.includes('auth')) {
                      wx.showToast({ title: '云存储权限不足，请检查权限设置', icon: 'none', duration: 3000 });
                    } else if (err.errMsg.includes('network')) {
                      wx.showToast({ title: '网络错误，请检查网络后重试', icon: 'none' });
                    } else {
                      wx.showToast({ title: '上传失败，请稍后重试', icon: 'none' });
                    }
                  }
                });
              },
              fail: (err) => {
                console.error('文件访问失败:', err);
                wx.showToast({ title: '图片文件不可用，请重新拍照', icon: 'none' });
              }
            });
          },
          fail: (err) => {
            console.error('网络检查失败:', err);
            wx.showToast({ title: '网络状态异常，请检查网络', icon: 'none' });
          }
        });
      }
    });
  }
});

// 说明：
// 1. 修复初始化：增加1.5秒延迟初始化（onLoad），并在onReady和cropperload中再次尝试。
// 2. 裁剪框：默认16:9（宽度=原始宽度，如887px；高度=宽度*9/16，如498px），移除lock_ratio，用户可自由调整。
// 3. 修复确认触发：在confirmCrop中验证this.cropper，添加日志，失败时回退压缩。
// 4. 修复全黑：提高quality至50，验证路径有效性。
// 5. 体积：保持~12.5KB，quality可调至40-60。
// 6. 安全性：移除index.js中的wx.cloud.init，使用envList.js；uploadToCloud添加用户验证。