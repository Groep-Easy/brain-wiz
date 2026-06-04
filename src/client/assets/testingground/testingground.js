/* global document, window */

const DEVICE_PRESETS = {
  'iphone-se': {
    label: 'iPhone SE',
    width: 375,
    height: 667,
  },
  'iphone-15': {
    label: 'iPhone 15',
    width: 393,
    height: 852,
  },
  'pixel-8': {
    label: 'Pixel 8',
    width: 412,
    height: 915,
  },
  'galaxy-s24': {
    label: 'Galaxy S24',
    width: 360,
    height: 780,
  },
}

const devicePreset = document.querySelector('#devicePreset')
const scaleRange = document.querySelector('#scaleRange')
const deviceSize = document.querySelector('#deviceSize')
const imageSource = document.querySelector('#imageSource')
const loadImageButton = document.querySelector('#loadImageButton')
const phoneFrame = document.querySelector('#phoneFrame')
const phoneRoot = document.querySelector('#phoneRoot')
const orientationButtons = document.querySelectorAll('[data-orientation]')

let orientation = 'portrait'
let reactRoot = null
let puzzleImageUrl = ''

function getSelectedDevice() {
  return DEVICE_PRESETS[devicePreset.value]
}

function getOrientedSize(device) {
  if (orientation === 'landscape') {
    return {
      width: device.height,
      height: device.width,
    }
  }

  return {
    width: device.width,
    height: device.height,
  }
}

function updateOrientationButtons() {
  orientationButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.orientation === orientation)
  })
}

function getPuzzleOptions() {
  return {
    imageUrl: puzzleImageUrl || undefined,
  }
}

function renderPhone() {
  const device = getSelectedDevice()
  const phoneSize = getOrientedSize(device)
  const scale = Number(scaleRange.value) / 100

  phoneFrame.style.setProperty('--phone-width', `${phoneSize.width}px`)
  phoneFrame.style.setProperty('--phone-height', `${phoneSize.height}px`)
  phoneFrame.style.setProperty('--phone-scale', scale.toString())
  deviceSize.textContent = `${device.label} - ${phoneSize.width} x ${phoneSize.height}px at ${scaleRange.value}%`

  if (!reactRoot) {
    reactRoot = window.BrainWizSlidingPuzzle.mountSlidingPuzzleGame(phoneRoot, getPuzzleOptions())
    return
  }

  reactRoot.render(
    window.React.createElement(window.BrainWizSlidingPuzzle.SlidingPuzzleGame, getPuzzleOptions())
  )
}

devicePreset.addEventListener('change', renderPhone)
scaleRange.addEventListener('input', renderPhone)
loadImageButton.addEventListener('click', () => {
  puzzleImageUrl = imageSource.value.trim()
  renderPhone()
})
imageSource.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') {
    return
  }

  puzzleImageUrl = imageSource.value.trim()
  renderPhone()
})

orientationButtons.forEach((button) => {
  button.addEventListener('click', () => {
    orientation = button.dataset.orientation
    updateOrientationButtons()
    renderPhone()
  })
})

updateOrientationButtons()
renderPhone()
