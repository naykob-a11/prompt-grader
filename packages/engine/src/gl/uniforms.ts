import { PARAM_KEYS, type ParamKey, type Params } from '../schema';

export type ParamLocations = ReadonlyMap<ParamKey, WebGLUniformLocation | null>;

const PLACEHOLDER = '// @param-uniforms';

/** Replaces the placeholder in a shader with one uniform per schema parameter. */
export function withParamUniforms(source: string): string {
  if (!source.includes(PLACEHOLDER)) throw new Error('shader has no parameter placeholder');
  return source.replace(PLACEHOLDER, PARAM_KEYS.map((k) => `uniform float u_${k};`).join('\n'));
}

export function paramLocations(gl: WebGL2RenderingContext, program: WebGLProgram): ParamLocations {
  return new Map(PARAM_KEYS.map((k) => [k, gl.getUniformLocation(program, `u_${k}`)]));
}

export function setParamUniforms(
  gl: WebGL2RenderingContext,
  locations: ParamLocations,
  params: Params,
): void {
  for (const [key, location] of locations) gl.uniform1f(location, params[key]);
}
