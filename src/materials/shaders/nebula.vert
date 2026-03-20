attribute float aSize;
attribute vec3 aColor;

uniform float uTime;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  // Gentle floating motion per-particle
  vec3 pos = position;
  float drift = sin(uTime * 0.3 + position.x * 2.0) * 0.1
              + cos(uTime * 0.25 + position.z * 1.5) * 0.1;
  pos.y += drift;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Point size with distance attenuation
  float sizeAttenuation = 300.0 / -mvPosition.z;
  gl_PointSize = aSize * uPixelRatio * sizeAttenuation;

  // Fade particles that are very far away
  float dist = length(mvPosition.xyz);
  vAlpha = smoothstep(200.0, 20.0, dist);

  gl_Position = projectionMatrix * mvPosition;
}
