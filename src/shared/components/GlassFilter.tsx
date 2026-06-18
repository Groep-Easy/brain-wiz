
export function GlassFilter() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
      <filter id="frosted" primitiveUnits="objectBoundingBox">
        <feImage href="{base64_img}" x="0" y="0" width="1" height="1" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.02" result="blur" />
        <feDisplacementMap in="blur" in2="map" scale="1" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="frosted-hover" primitiveUnits="objectBoundingBox">
        <feImage href="{base64_img}" x="0" y="0" width="1" height="1" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.02" result="blur" />
        <feDisplacementMap in="blur" in2="map" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
