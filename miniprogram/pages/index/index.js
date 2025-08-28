const WeCropper = require('../../components/we-cropper/we-cropper.js');

Page({
  data: {
    imageSrc: '', // 拍照后的图片路径
    cropperWidth: 0, // 裁剪框宽度
    cropperHeight: 0, // 裁剪框高度
    showCropper: false // 控制裁剪控件显示
  },

  onLoad() {
    // 初始化裁剪框尺寸
    const { windowWidth, windowHeight } = wx.getSystemInfoSync();
    this.setData({
      cropperWidth: windowWidth * 0.9,
      cropperHeight: windowHeight * 0.6
    });

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
        this.setData({
          imageSrc: res.tempFilePaths[0],
          showCropper: true
        });
        this.initCropper();
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

  // 初始化裁剪器
  initCropper() {
    const { cropperWidth, cropperHeight, imageSrc } = this.data;
    this.cropper = new WeCropper(this.selectComponent('#we-cropper'), {
      id: 'we-cropper',
      width: cropperWidth,
      height: cropperHeight,
      scale: 2.5, // 最大缩放倍数
      zoom: 8, // 缩放系数
      cut: {
        x: 0,
        y: 0,
        width: cropperWidth,
        height: cropperHeight
      }
    });
    this.cropper.pushOrign(imageSrc);
    wx.showLoading({
      title: '加载中'
    });
  },

  // 裁剪器准备就绪
  cropperReady(e) {
    console.log('cropper 准备就绪', e);
  },

  // 图片开始加载
  beforeImageLoad(e) {
    console.log('图片开始加载', e);
  },

  // 图片加载完成
  imageLoad(e) {
    console.log('图片加载完成', e);
    wx.hideLoading();
  },

  // 点击裁剪框
  tapCut(e) {
    console.log('裁剪框交互:', e.detail);
    wx.previewImage({
      current: e.detail.url,
      urls: [e.detail.url]
    });
  },

  // 确认剪裁
  getCroppedImage() {
    this.cropper.getCropperImage(res => {
      if (res) {
        this.compressToTargetSize(res).then(compressedPath => {
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