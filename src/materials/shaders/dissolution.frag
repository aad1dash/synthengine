uniform float uProgress;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vEdge;

// Simple hash for procedural noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // Dissolve mask: per-fragment noise compared against uProgress.
  // Fragments whose noise value is above the progress threshold are discarded
  // (they haven't materialised yet).
  float n = noise2D(vUv * 10.0 + vWorldPosition.xz * 2.0);
  float dissolveThreshold = uProgress;

  if (n > dissolveThreshold + 0.05) {
    discard;
  }

  // Edge glow: fragments near the dissolve boundary get an energy overlay.
  float edgeDist = dissolveThreshold + 0.05 - n;
  float edgeGlow = smoothstep(0.0, 0.1, edgeDist) * (1.0 - smoothstep(0.1, 0.2, edgeDist));

  // Combine vertex-level and fragment-level edge detection
  float totalEdge = max(edgeGlow, vEdge * (1.0 - uProgress));

  // Energy pulse along the edge
  float pulse = sin(uTime * 8.0 + vWorldPosition.y * 10.0) * 0.5 + 0.5;
  vec3 glow = uGlowColor * totalEdge * (0.7 + 0.3 * pulse);

  // Basic diffuse-like shading using the normal
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float diff = max(dot(normalize(vNormal), lightDir), 0.0) * 0.6 + 0.4;

  vec3 color = uBaseColor * diff + glow * 2.0;

  // Opacity ramps up with progress; edge fragments are always visible for the glow
  float alpha = smoothstep(0.0, 0.15, edgeDist) + totalEdge * 0.6;
  alpha = clamp(alpha, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
