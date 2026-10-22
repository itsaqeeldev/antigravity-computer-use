// Adapted from Anthropic claude-quickstarts computer_use/image.py (MIT),
// 9ec32b91df50b0d4906cae64b13c6298055ff40d. Budgets are OUR transport limits,
// not a claim about Gemini's vision encoder. Coordinates map back to native source.
export function targetImageSize(width,height,{maxEdge=1400,maxTiles=1600,tile=28}={}){
 const fits=(w,h)=>w<=maxEdge&&h<=maxEdge&&Math.ceil(w/tile)*Math.ceil(h/tile)<=maxTiles;
 if(fits(width,height))return [width,height];
 if(height>width){const [w,h]=targetImageSize(height,width,{maxEdge,maxTiles,tile});return [h,w];}
 const aspect=width/height;let lo=1,hi=width;
 while(lo+1<hi){const mid=Math.floor((lo+hi)/2),h=Math.max(Math.round(mid/aspect),1);if(fits(mid,h))lo=mid;else hi=mid;}
 return [lo,Math.max(Math.round(lo/aspect),1)];
}
