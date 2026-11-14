/** GLSL sources for the three programs of the renderer. */

export const SHAPE_VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec2 a_pos;
layout(location=2) in vec2 a_size;
layout(location=3) in vec2 a_rs;
layout(location=4) in vec2 a_ps;
layout(location=5) in vec2 a_glow;
layout(location=6) in vec4 a_fill;
layout(location=7) in vec4 a_line;
uniform vec4 u_cam;
uniform float u_px;
out vec2 v_p;
flat out vec2 v_size;
flat out vec4 v_par;
flat out vec2 v_glow;
flat out vec4 v_fill;
flat out vec4 v_line;
void main() {
  float pad = a_glow.x + u_px * 1.5;
  vec2 local = a_corner * (a_size + pad);
  float c = cos(a_rs.x), s = sin(a_rs.x);
  vec2 world = a_pos + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  gl_Position = vec4((world - u_cam.xy) * u_cam.zw, 0.0, 1.0);
  v_p = local;
  v_size = a_size;
  v_par = vec4(a_rs.y, a_ps.x, a_ps.y, 0.0);
  v_glow = a_glow;
  v_fill = a_fill;
  v_line = a_line;
}`;

export const SHAPE_FS = `#version 300 es
precision highp float;
in vec2 v_p;
flat in vec2 v_size;
flat in vec4 v_par;
flat in vec2 v_glow;
flat in vec4 v_fill;
flat in vec4 v_line;
uniform float u_px;
out vec4 o;

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float sdTri(vec2 p, vec2 b) {
  vec2 q = vec2(b.x, 2.0 * b.y);
  p = vec2(abs(p.x), b.y - p.y);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 c = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2(dot(c, c), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  int shape = int(v_par.x + 0.5);
  float p1 = v_par.y;
  float stroke = v_par.z;
  vec2 p = v_p;
  float d;
  float fillMul = 1.0;

  if (shape == 4) {
    // Soft light blob: pure additive falloff, no hard edge.
    vec2 q = p / v_size;
    float r2 = dot(q, q);
    float a = exp(-r2 * 3.2) * (1.0 - smoothstep(0.8, 1.0, sqrt(r2)));
    o = vec4(v_fill.rgb * v_fill.a * a, 0.0);
    return;
  }
  if (shape == 1) {
    d = length(p) - v_size.x;
  } else if (shape == 2) {
    d = sdTri(p, v_size) - p1;
  } else if (shape == 3) {
    float ang = atan(p.y, p.x);
    float teeth = 0.5 + 0.5 * cos(ang * p1);
    d = length(p) - v_size.x * (0.82 + 0.18 * smoothstep(0.25, 0.75, teeth));
  } else if (shape == 7) {
    d = sdHex(p, v_size.x * 0.866);
  } else {
    d = sdBox(p, v_size, shape == 5 ? 0.0 : p1);
  }

  float aa = u_px;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec4 fill = v_fill;

  if (shape == 5) {
    // Vertical fade: opaque at the top edge, transparent at the bottom.
    float t = clamp((p.y + v_size.y) / (2.0 * v_size.y), 0.0, 1.0);
    fillMul = pow(t, max(p1, 0.05));
  } else if (shape == 6) {
    // Structural block: subtle inner cell grid anchored to the block corner.
    vec2 g = abs(fract(p + v_size + 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, aa * 1.5 + 0.015, min(g.x, g.y));
    float top = clamp((p.y + v_size.y) / (2.0 * v_size.y), 0.0, 1.0);
    fill.rgb += v_line.rgb * (line * 0.10 + top * top * 0.07);
  }

  float band = stroke > 0.0 ? inside * smoothstep(-stroke - aa, -stroke + aa, d) : 0.0;
  vec3 rgb = mix(fill.rgb, v_line.rgb, band * v_line.a);
  float alpha = mix(fill.a * fillMul, 1.0, band * v_line.a) * inside;
  float glow = v_glow.y * exp(-max(d, 0.0) / max(v_glow.x, 0.0001) * 3.0) * (1.0 - inside * 0.65);
  o = vec4(rgb * alpha + v_line.rgb * glow, alpha);
}`;

export const RIBBON_VS = `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_va;
uniform vec4 u_cam;
out vec2 v_va;
void main() {
  gl_Position = vec4((a_pos - u_cam.xy) * u_cam.zw, 0.0, 1.0);
  v_va = a_va;
}`;

export const RIBBON_FS = `#version 300 es
precision highp float;
in vec2 v_va;
uniform vec4 u_color;
uniform float u_core;
out vec4 o;
void main() {
  float v = abs(v_va.x);
  float body = pow(1.0 - v, 1.4);
  float core = smoothstep(0.55, 0.0, v) * u_core;
  float a = v_va.y * u_color.a;
  o = vec4((u_color.rgb * body + vec3(core)) * a, body * a * 0.35);
}`;

export const BG_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const BG_FS = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_pulse;
uniform float u_energy;
uniform float u_horizon;
uniform float u_scroll;
uniform float u_quality;
uniform vec3 u_sky0;
uniform vec3 u_sky1;
uniform vec3 u_acc;
uniform vec3 u_acc2;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float skyline(float x, float seed) {
  return hash(vec2(floor(x), seed)) * 0.55 + hash(vec2(floor(x * 0.25), seed + 7.0)) * 0.45;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 uv = px / u_res;
  float y = (px.y - u_horizon) / u_res.y;
  float hx = (uv.x - 0.5) * u_res.x / u_res.y;
  float t = clamp(y / 0.8, 0.0, 1.0);
  vec3 col;

  if (y >= 0.0) {
    col = mix(u_sky1, u_sky0, pow(t, 0.62));
    // Horizon bloom and a broad light source that breathes with the kick.
    col += u_acc2 * exp(-y * 7.0) * (0.16 + 0.22 * u_pulse);
    float d = length(vec2(hx * 0.75, y - 0.2));
    col += u_acc * exp(-d * d * 7.0) * (0.07 + 0.09 * u_pulse * u_energy);

    if (u_quality > 0.5) {
      // Slow diagonal light shafts.
      float sh = sin((hx + y * 0.9) * 2.6 + u_time * 0.07) * 0.5 + 0.5;
      col += u_acc2 * pow(sh, 6.0) * 0.045 * (1.0 - t);

      // Star field.
      vec2 sp = (px + vec2(u_scroll * 0.04, 0.0)) / u_res.y * 46.0;
      vec2 id = floor(sp);
      vec2 f = fract(sp) - 0.5;
      float h = hash(id);
      float tw = 0.55 + 0.45 * sin(u_time * (0.8 + h * 2.0) + h * 40.0);
      float star = step(0.94, h) * smoothstep(0.11, 0.0, length(f + (vec2(hash(id + 3.1), hash(id + 9.7)) - 0.5) * 0.6));
      col += vec3(star * tw * 0.55 * smoothstep(0.05, 0.5, y));

      // Two parallax skylines of stepped monoliths.
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float cw = 0.062 - 0.02 * fi;
        float x = (px.x + u_scroll * (0.10 + 0.16 * fi)) / u_res.y / cw;
        float hgt = (0.07 + 0.2 * skyline(x, 3.0 + fi * 11.0)) * (1.0 - 0.38 * fi) + 0.015;
        float m = step(y, hgt);
        vec3 lay = mix(u_sky0, u_sky1, 0.3 + 0.3 * fi) * (0.5 + 0.3 * fi);
        float fx = fract(x);
        float edge = smoothstep(hgt - 0.0045, hgt - 0.001, y);
        float side = smoothstep(0.035, 0.0, min(fx, 1.0 - fx)) * 0.25;
        float win = step(0.86, hash(vec2(floor(x * 3.0), floor(y * 90.0) + fi * 31.0))) * 0.14;
        lay += u_acc * (edge * (0.22 + 0.5 * u_pulse) + side * 0.12 + win * (0.4 + u_pulse)) * (0.55 + 0.45 * fi);
        col = mix(col, lay, m);
      }
    }
  } else {
    col = mix(u_sky0 * 0.55, u_sky1 * 0.5, exp(y * 5.0));
    col += u_acc * exp(y * 26.0) * (0.05 + 0.06 * u_pulse);
  }

  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.85;
  col += (hash(px + fract(u_time)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;
