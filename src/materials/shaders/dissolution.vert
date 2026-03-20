uniform float uProgress;
uniform float uTime;

attribute vec3 aScatterOrigin;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vEdge;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // When uProgress == 0, vertices are at their scattered origin.
  // When uProgress == 1, vertices are at their final mesh position.
  // Smooth easing via smoothstep keeps the motion organic.
  float t = smoothstep(0.0, 1.0, uProgress);

  vec3 scattered = aScatterOrigin;
  vec3 finalPos  = position;

  // Add a small spiral while converging
  float angle = (1.0 - t) * 6.2831 * 2.0 + uTime * 0.5;
  float spiralRadius = (1.0 - t) * 0.3;
  vec3 spiral = vec3(cos(angle) * spiralRadius, sin(angle) * spiralRadius, 0.0);

  vec3 pos = mix(scattered, finalPos, t) + spiral * (1.0 - t);

  // Edge detection: vertices near the dissolve boundary glow.
  // We use noise-like per-vertex variation based on position hash.
  float posHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
  float edgeThreshold = posHash;
  vEdge = 1.0 - smoothstep(max(0.0, uProgress - 0.15), uProgress, edgeThreshold);

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
