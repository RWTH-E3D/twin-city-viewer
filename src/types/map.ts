export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface MapSettings {
  baseStyleUrl: string;
  terrainSourceUrl: string;
}

export interface SemanticColorsState {
  semanticSurfaces: Record<string, RGBAColor>;
  defaultOpacity: number;
}