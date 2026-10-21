export function getCenteredSquareCrop(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Image dimensions must be positive numbers')
  }

  const side = Math.min(width, height)
  return {
    x: (width - side) / 2,
    y: (height - side) / 2,
    width: side,
    height: side,
  }
}

export function cropPhotoToSquare(source, outputSize = 512) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Photo cropping is only available in a browser'))
      return
    }

    const image = new Image()
    if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const crop = getCenteredSquareCrop(image.naturalWidth, image.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Could not prepare the photo')
        context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize)
        resolve(canvas.toDataURL('image/jpeg', 0.94))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('Could not load the photo'))
    image.src = source
  })
}
