export const QUALITY_PROFILES = Object.freeze({
  LOW: Object.freeze({renderScale:.75}),
  MEDIUM: Object.freeze({renderScale:1}),
  HIGH: Object.freeze({renderScale:1.25}),
});
export type Quality = keyof typeof QUALITY_PROFILES;
export function parseQuality(value:string|null):Quality{return value==='LOW'||value==='HIGH'?value:'MEDIUM';}
/** MEDIUM retains the existing render resolution; profiles never tune simulation or voice/effect limits. */
export function qualityScaling(quality:Quality,pixelRatio:number,maxPixelRatio:number){
  return Math.max(1,pixelRatio/maxPixelRatio)/QUALITY_PROFILES[quality].renderScale;
}
