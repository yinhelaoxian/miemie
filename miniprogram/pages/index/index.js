Page({
  data: {
    imageSrc: '', // 拍照后的图片路径
    showCropper: false // 控制裁剪控件显示
  },

  onLoad() {
    // 检查云开发环境
    if (!wx.cloud) {
      wx.showToast({
        title: '云开发未初始化',
        icon: 'none'
      });
      return;
    }
  },

  // 拍照
  takePhoto() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera'],
      success: res => {
        console.log('拍照路径:', res.tempFilePaths[0]);
        // 预压缩图片以降低分辨率
        this.preCompressImage(res.tempFilePaths[0]).then(preCompressedPath => {
          this.setData({
            imageSrc: preCompressedPath,
            showCropper: true
          });
          wx.showLoading({
            title: '加载中'
          });
        }).catch(err => {
          console.error('预压缩失败', err);
          wx.showToast({
            title: '图片处理失败',
            icon: 'none'
          });
        });
      },
      fail: err => {
        console.error('拍照失败', err);
        wx.showToast({
          title: '拍照失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 预压缩图片
  preCompressImage(src) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: src,
        quality: 80,
        success: res => {
          console.log('预压缩路径:', res.tempFilePath);
          resolve(res.tempFilePath);
        },
        fail: err => {
          console.error('预压缩失败', err);
          reject(err);
        }
      });
    });
  },

  // 裁剪控件初始化完成
  cropperload(e) {
    console.log('cropper 初始化完成', e);
    this.cropper = this.selectComponent('#image-cropper');
    console.log('cropper 实例:', this.cropper);
  },

  // 图片加载完成
  loadimage(e) {
    console.log('图片加载完成', e.detail);
    const { width: originalWidth, height: originalHeight } = e.detail;

    try {
      console.log('图片尺寸:', originalWidth, originalHeight);
      if (!this.cropper) {
        console.error('cropper 未初始化');
        wx.showToast({
          title: '裁剪控件未加载',
          icon: 'none'
        });
      } else {
        // 延迟检查组件状态
        setTimeout(() => {
          console.log('cropper 属性:', this.cropper.data);
        }, 200);
      }
    } catch (err) {
      console.error('加载裁剪控件失败', err);
      wx.showToast({
        title: '加载裁剪控件失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading(); // 确保加载提示关闭
    }
  },

  // 点击裁剪框预览图片
  clickcut(e) {
    console.log('裁剪框交互:', e.detail);
    wx.previewImage({
      current: e.detail.url,
      urls: [e.detail.url]
    });
  },

  // 确认剪裁并获取图片
  getCroppedImage() {
    this.cropper.getImg(res => {
      if (res.url) {
        this.compressToTargetSize(res.url).then(compressedPath => {
          this.uploadToCloud(compressedPath);
          this.setData({
            showCropper: false
          });
        }).catch(err => {
          console.error('压缩失败', err);
          wx.showToast({
            title: '压缩失败，请重试',
            icon: 'none',
            duration: 2000
          });
        });
      } else {
        wx.showToast({
          title: '裁剪失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 压缩图片到目标大小范围 (20K-100K)
  compressToTargetSize(src) {
    const targetMaxSize = 100 * 1024; // 100K
    const targetMinSize = 20 * 1024; // 20K
    let quality = 60; // 初始质量
    let filePath = src;
    let compressCount = 0; // 压缩次数计数
    const maxCompressCount = 15; // 最大压缩次数

    return new Promise((resolve, reject) => {
      const compressLoop = () => {
        if (compressCount >= maxCompressCount) {
          console.log('达到最大压缩次数:', compressCount);
          resolve(filePath);
          return;
        }

        wx.compressImage({
          src: filePath,
          quality: quality,
          success: res => {
            const compressedPath = res.tempFilePath;
            let size;
            try {
              size = this.getFileSize(compressedPath);
              console.log('压缩后大小:', size / 1024, 'KB', '当前质量:', quality);
            } catch (err) {
              console.error('获取文件大小失败', err);
              reject(err);
              return;
            }

            if (size > targetMaxSize && quality > 30) {
              quality -= 5; // 减小步长
              filePath = compressedPath;
              compressCount++;
              compressLoop(); // 继续压缩
            } else {
              resolve(compressedPath); // 大小合适或质量已最低
            }
          },
          fail: err => {
            console.error('压缩失败', err);
            reject(err);
          }
        });
      };

      compressLoop();
    });
  },

  // 获取文件大小
  getFileSize(filePath) {
    const fs = wx.getFileSystemManager();
    const stat = fs.statSync(filePath);
    return stat.size;
  },

  // 取消裁剪
  cancelCrop() {
    this.setData({
      showCropper: false,
      imageSrc: ''
    });
    wx.showToast({
      title: '已取消',
      icon: 'none'
    });
  },

  // 上传到腾讯云存储（兼容 yinhelaoxian/miemie）
  uploadToCloud(filePath) {
    wx.cloud.uploadFile({
      cloudPath: `images/${Date.now()}.jpg`,
      filePath: filePath,
      success: res => {
        console.log('上传成功', res.fileID);
        wx.showToast({
          title: '上传成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: err => {
        console.error('上传失败', err);
        wx.showToast({
          title: '上传失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }
});