export const SFX = (source: string) => {
  const rawData = new Audio(source)
  rawData.preload = 'auto'
  void rawData.play()
}
