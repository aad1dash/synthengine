varying vec3 vColor;
varying float vAlpha;

void main() {
  // Distance from centre of the point sprite (gl_PointCoord is 0-1)
  vec2 centre = gl_PointCoord - vec2(0.5);
  float dist = length(centre);

  // Discard fragments outside the circle
  if (dist > 0.5) discard;

  // Soft radial falloff — gives a gaseous, glowing look
  float radialAlpha = 1.0 - smoothstep(0.0, 0.5, dist);

  // Extra subtle glow ring at the edge
  float glow = smoothstep(0.35, 0.45, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
  glow *= 0.4;

  vec3 color = vColor + vColor * glow * 2.0;
  float alpha = (radialAlpha + glow) * vAlpha;

  gl_FragColor = vec4(color, alpha);
}
