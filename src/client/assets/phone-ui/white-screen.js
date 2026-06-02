/* global window */

const DEFAULT_PHONE_SIZE = {
  width: 390,
  height: 844,
}

function getReact() {
  if (!window.React) {
    throw new Error('React must be loaded before white-screen.js')
  }

  return window.React
}

function normalizePhoneSize(phoneSize) {
  return {
    width: Number(phoneSize?.width ?? DEFAULT_PHONE_SIZE.width),
    height: Number(phoneSize?.height ?? DEFAULT_PHONE_SIZE.height),
  }
}

function WhitePhoneScreen({ phoneSize = DEFAULT_PHONE_SIZE } = {}) {
  const React = getReact()
  const normalizedPhoneSize = normalizePhoneSize(phoneSize)

  return React.createElement('main', {
    'aria-label': 'Phone user interface preview',
    className: 'phone-white-screen',
    style: {
      '--phone-width': `${normalizedPhoneSize.width}px`,
      '--phone-height': `${normalizedPhoneSize.height}px`,
    },
  })
}

function getReactDomClient() {
  if (!window.ReactDOM) {
    throw new Error('ReactDOM must be loaded before white-screen.js')
  }

  return window.ReactDOM
}

function mountWhitePhoneScreen(target, options = {}) {
  const React = getReact()
  const ReactDOM = getReactDomClient()
  const root = ReactDOM.createRoot(target)

  root.render(React.createElement(WhitePhoneScreen, options))

  return root
}

window.BrainWizPhoneUi = {
  WhitePhoneScreen,
  mountWhitePhoneScreen,
}
