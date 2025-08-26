// miniprogram/pages/index/index.js
Page({
  data: {
    showCropper: false,
    originalPath: '',
    cropperWidth: 300,
    cropperHeight: 169,
    thumbnail: '',
    compressedPath: '',
    fileSize: 0
  },

  onLoad: function () {
    setTimeout(() => {
      this.initCropper();
    }, 3000);
  },

  onReady: function () {
    if (!this.cropper) {
      this.initCropper();
    }
  },

  initCropper: function () {
    this.cropper = this.selectComponent("#image-cropper");
    if (!this.cropper) {
      console.error('裁剪组件初始化失败，等待重试');
    } else {
      console.log('裁剪组件初始化成功');
    }
  },

  takePhoto: function () {
    const that = this;
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
            wx.getFileSystemManager().access({
              path: originalPath,
              success: () => {
                wx.getImageInfo({
                  src: originalPath,
                  success: (info) => {
                    console.log('原始图片信息:', info);
                    const defaultWidth = Math.floor(info.width * 0.9); // 90%宽度
                    const defaultHeight = Math.floor(defaultWidth * (9 / 16)); // 初始16:9
                    that.setData({
                      showCropper: true,
                      originalPath: originalPath,
                      cropperWidth: defaultWidth,
                      cropperHeight: defaultHeight
                    });
                    wx.showToast({ title: '请拖动或缩放裁剪框（默认90%宽度）', icon: 'none' });
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

  cropperload: function (e) {
    console.log('裁剪组件加载完成:', e);
    if (!this.cropper) {
      this.initCropper();
    }
  },

  loadimage: function (e) {
    console.log('图片加载完成:', e.detail);
    wx.hideLoading();
    if (this.cropper) {
      this.cropper.imgReset();
    } else {
      console.error('裁剪组件未初始化，将直接压缩');
      wx.showToast({ title: '裁剪组件未初始化，将直接压缩', icon: 'none', duration: 3000 });
      this.compressWithFallback(this.data.originalPath);
    }
  },

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

        // 使用canvas转换为JPEG并压缩
        const ctx = wx.createCanvasContext('tempCanvas', this);
        wx.getImageInfo({
          src: croppedPath,
          success: (info) => {
            console.log('裁剪图片信息:', info);
            const canvasWidth = info.width;
            const canvasHeight = info.height;
            ctx.drawImage(croppedPath, 0, 0, canvasWidth, canvasHeight);
            ctx.draw(false, () => {
              wx.canvasToTempFilePath({
                canvasId: 'tempCanvas',
                fileType: 'jpg',
                quality: 0.4,
                success: (canvasRes) => {
                  const compressedPath = canvasRes.tempFilePath;
                  console.log('JPEG压缩成功，压缩路径:', compressedPath);
                  wx.getFileSystemManager().stat({
                    path: compressedPath,
                    success: (statRes) => {
                      const fileSize = Math.round(statRes.stat.size / 1024);
                      console.log('压缩图片大小:', fileSize, 'KB');
                      if (fileSize > 50) {
                        console.warn('压缩后图片过大，尝试更低质量');
                        that.compressWithFallback(croppedPath);
                      } else {
                        that.setData({
                          thumbnail: compressedPath,
                          compressedPath: compressedPath,
                          showCropper: false,
                          fileSize: fileSize
                        });
                        wx.showToast({ title: `裁剪压缩成功（${fileSize}KB）`, icon: 'success' });
                      }
                    },
                    fail: (err) => {
                      console.error('获取文件大小失败:', err);
                      that.setData({
                        thumbnail: compressedPath,
                        compressedPath: compressedPath,
                        showCropper: false,
                        fileSize: 0
                      });
                      wx.showToast({ title: '裁剪压缩成功', icon: 'success' });
                    }
                  });
                },
                fail: (err) => {
                  console.error('canvas导出JPEG失败:', err);
                  wx.showToast({ title: '图片压缩失败，尝试备用方案', icon: 'none' });
                  that.compressWithFallback(croppedPath);
                }
              }, this);
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

  compressWithFallback: function (originalPath) {
    const that = this;
    wx.compressImage({
      src: originalPath,
      quality: 30,
      success: (compressRes) => {
        const compressedPath = compressRes.tempFilePath;
        console.log('回退压缩成功，压缩路径:', compressedPath);
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success: (statRes) => {
            const fileSize = Math.round(statRes.stat.size / 1024);
            console.log('回退压缩图片大小:', fileSize, 'KB');
            that.setData({
              thumbnail: compressedPath,
              compressedPath: compressedPath,
              showCropper: false,
              fileSize: fileSize
            });
            wx.showToast({ title: `图片压缩成功（${fileSize}KB，未裁剪）`, icon: 'success' });
          },
          fail: (err) => {
            console.error('获取回退压缩文件大小失败:', err);
            that.setData({
              thumbnail: compressedPath,
              compressedPath: compressedPath,
              showCropper: false,
              fileSize: 0
            });
            wx.showToast({ title: '图片压缩成功（未裁剪）', icon: 'success' });
          }
        });
      },
      fail: (err) => {
        console.error('回退压缩失败:', err);
        wx.showToast({ title: '图片压缩失败，请重试', icon: 'none' });
      }
    });
  },

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

  uploadToCloud: function () {
    const { compressedPath, thumbnail } = this.data;
    if (!compressedPath) {
      wx.showToast({ title: '无图片可上传', icon: 'none' });
      return;
    }

    if (!wx.cloud) {
      console.error('云开发未初始化');
      wx.showToast({ title: '云开发未初始化，请检查配置', icon: 'none', duration: 3000 });
      return;
    }

    wx.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none') {
          wx.showToast({ title: '无网络连接，请检查网络', icon: 'none' });
          return;
        }

        wx.getFileSystemManager().access({
          path: compressedPath,
          success: () => {
            wx.showLoading({ title: '正在上传...', mask: true });
            const cloudPath = `wrong-questions/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
            wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: compressedPath,
              success: (uploadRes) => {
                console.log('上传成功，云文件ID:', uploadRes.fileID);
                wx.cloud.getTempFileURL({
                  fileList: [uploadRes.fileID],
                  success: (urlRes) => {
                    wx.hideLoading();
                    const cloudUrl = urlRes.fileList[0].tempFileURL;
                    console.log('云存储临时URL:', cloudUrl);
                    this.setData({
                      thumbnail: cloudUrl,
                      compressedPath: '',
                      fileSize: this.data.fileSize
                    });
                    wx.showToast({ title: '已成功存储到云端服务器', icon: 'success' });
                  },
                  fail: (err) => {
                    wx.hideLoading();
                    console.error('获取云存储URL失败:', err);
                    this.setData({
                      compressedPath: ''
                    });
                    wx.showToast({ title: '云存储成功，但获取URL失败', icon: 'none' });
                  }
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