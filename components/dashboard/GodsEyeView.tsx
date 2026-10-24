"use client";
import {useEffect,useRef,useState} from 'react';
import {Expand,Home,Layers,MapPin,Minus,Plus} from 'lucide-react';
import {Select as AuthoredSelect,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {factQualification} from '@/lib/dashboard-search.mjs';
import {entityLocation} from '@/lib/dashboard-model.mjs';

type Entity={id:string;display_name:string;identifiers?:Record<string,unknown>};
export default function GodsEyeView({entities=[],onEntity,expanded=false,data={}}:{entities:Entity[];onEntity?:(id:string)=>void;expanded?:boolean;data?:Record<string,any>}){
 const host=useRef<HTMLDivElement>(null),credits=useRef<HTMLDivElement>(null),viewerRef=useRef<any>(null),engine=useRef<any>(null),effects=useRef<any>(null);
 const [style,setStyle]=useState('normal'),[showLocations,setShowLocations]=useState(true);
 const [state,setState]=useState('Loading the world view…'),[error,setError]=useState(''),[imagery,setImagery]=useState(true),[full,setFull]=useState(expanded);
 const points=entities.map(e=>({entity:e,location:entityLocation(e,data)})).filter(x=>x.location);
 const navigate=useRef(onEntity);navigate.current=onEntity;
 useEffect(()=>{
  let stopped=false,viewer:any,handler:any,disposePinch:(()=>void)|undefined;
  const begin=async()=>{
   // Keep Cesium out of the Worker server bundle; only the browser owns WebGL.
   if(import.meta.env.SSR)return;
   try{
    (window as any).CESIUM_BASE_URL='/cesium/';
    const [C,gev,visual]=await Promise.all([import('cesium'),import('@/vendor/gods-eye-view/src/app/viewer.js'),import('@/vendor/gods-eye-view/src/ui/visualEffects.js')]);
    if(stopped||!host.current||!credits.current)return;
    engine.current=C;
    C.Ion.defaultAccessToken='';
    viewer=gev.createApplicationViewer({container:host.current,creditContainer:credits.current});
    effects.current=new visual.VisualEffects({viewer,requestRender:()=>viewer.scene.requestRender(),holdRender:()=>{viewer.scene.requestRenderMode=false;},releaseRender:()=>{viewer.scene.requestRenderMode=true;viewer.scene.requestRender();}});effects.current.initStyles();
    viewerRef.current=viewer;disposePinch=gev.installTrackpadPinchZoom(viewer);
    viewer.scene.globe.show=true;viewer.scene.globe.baseColor=C.Color.fromCssColorString('#1b2924');
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#080b09');
    viewer.scene.requestRenderMode=true;viewer.targetFrameRate=30;
    viewer.camera.setView({destination:C.Cartesian3.fromDegrees(25,12,24000000)});
    try{
     const base=new C.UrlTemplateImageryProvider({url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maximumLevel:18,credit:'© OpenStreetMap contributors'});
     const layer=viewer.imageryLayers.addImageryProvider(base);
     layer.brightness=.38;layer.contrast=1.3;layer.saturation=.25;
    }catch{setState('Basemap unavailable. Verified locations remain available below.');}
    handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement:any)=>{const picked=viewer.scene.pick(movement.position);if(picked?.id?.properties?.crmId)navigate.current?.(String(picked.id.properties.crmId.getValue()));},C.ScreenSpaceEventType.LEFT_CLICK);
    viewer.scene.renderError.addEventListener(()=>{if(!stopped)setError('The 3D view stopped rendering. Use the location register below or reload the page.');});
    if(!stopped)setState('Source: OpenStreetMap · case locations require evidence');
   }catch{if(!stopped)setError('This browser could not start the 3D world view. The location register is available below.');}
  };void begin();
  return()=>{stopped=true;effects.current?.destroy();effects.current=null;handler?.destroy();disposePinch?.();if(viewer&&!viewer.isDestroyed())viewer.destroy();viewerRef.current=null;};
 },[]);
 useEffect(()=>{
   const viewer=viewerRef.current,C=engine.current;if(!viewer||!C)return;
   viewer.entities.removeAll();
   for(const {entity,location} of (showLocations?points:[])){if(!location)continue;viewer.entities.add({id:entity.id,name:entity.display_name,position:C.Cartesian3.fromDegrees(location.lon,location.lat),point:{pixelSize:8,color:C.Color.fromCssColorString('#D4AF37'),outlineColor:C.Color.BLACK,outlineWidth:2},label:{text:entity.display_name,font:'11px sans-serif',fillColor:C.Color.WHITE,pixelOffset:new C.Cartesian2(0,-15),showBackground:true,backgroundColor:C.Color.fromCssColorString('#111111cc'),distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000000)},properties:{crmId:entity.id}});}
   viewer.scene.requestRender();
 },[entities,state,showLocations]);
 useEffect(()=>{const fx=effects.current;if(!fx)return;for(const [name,stage]of Object.entries(fx.stages))fx.setStageIntensity(stage,name===style?0.65:0);},[style,state]);
 useEffect(()=>{const viewer=viewerRef.current;if(viewer){for(let i=0;i<viewer.imageryLayers.length;i++)viewer.imageryLayers.get(i).show=imagery;viewer.scene.requestRender();}},[imagery]);
 useEffect(()=>{const timer=setTimeout(()=>viewerRef.current?.resize(),100);return()=>clearTimeout(timer);},[full]);
 const zoom=(out=false)=>{const viewer=viewerRef.current;if(!viewer)return;const amount=viewer.camera.positionCartographic.height*.35;out?viewer.camera.zoomOut(amount):viewer.camera.zoomIn(amount);viewer.scene.requestRender();};
 return <section className={'dash-panel world-panel'+(full?' world-expanded':'')} aria-label="God’s Eye View">
  <div className="dash-panel-head"><div><p className="dash-eyebrow">World intelligence</p><h2>The operating landscape</h2></div><div className="world-actions"><button onClick={()=>setImagery(v=>!v)} aria-pressed={imagery} title="Toggle basemap"><Layers size={15}/><span>Basemap</span></button><button onClick={()=>{const C=engine.current;viewerRef.current?.camera.flyTo({destination:C.Cartesian3.fromDegrees(25,12,24000000),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:.8});}} aria-label="Reset world view"><Home size={15}/></button><button onClick={()=>setFull(v=>!v)} aria-label={full?'Exit expanded world view':'Expand world view'} aria-pressed={full}><Expand size={15}/></button></div></div>
  <div className="world-layerbar"><label><input type="checkbox" checked={showLocations} onChange={e=>setShowLocations(e.target.checked)}/> Case locations</label><AuthoredSelect value={style} onValueChange={setStyle}><SelectTrigger className="dash-select" aria-label="Globe visual style"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Natural basemap</SelectItem><SelectItem value="noir">Noir visual effect</SelectItem><SelectItem value="surveillance">Night-vision visual effect</SelectItem><SelectItem value="thermal">Thermal visual effect</SelectItem></SelectContent></AuthoredSelect><span>Effects change appearance; they are not sensor readings.</span></div>
  <div className="world-canvas" ref={host} tabIndex={0} aria-label="Interactive globe. Drag to rotate, scroll to zoom. Accessible locations appear below."/>
  <div className="world-zoom"><button onClick={()=>zoom()} aria-label="Zoom in"><Plus size={16}/></button><button onClick={()=>zoom(true)} aria-label="Zoom out"><Minus size={16}/></button></div>
  <div className="world-status" role="status">{error||state}</div><div ref={credits} className="world-credits"/>
  <div className="world-footer"><span><MapPin size={12}/> {points.length} evidence-located · {entities.length-points.length} unplaced</span><span>God’s Eye View · no simulated feeds</span></div>
  <details className="world-register"><summary>Location register & feed availability</summary><p>Map positions are shown only where coordinates and a source are recorded. Vessel, satellite and camera feeds are not configured; no simulated activity is presented as live.</p>{points.length?<ul>{points.map(({entity,location})=><li key={entity.id}><button onClick={()=>{const C=engine.current;if(C)viewerRef.current?.camera.flyTo({destination:C.Cartesian3.fromDegrees(location!.lon,location!.lat,300000),duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1});}}>{entity.display_name} · locate</button><button onClick={()=>onEntity?.(entity.id)}>Open profile</button><span>{location?.lat}, {location?.lon} · {location?.precision} · {factQualification(entity,(entity.identifiers as any)?.location||(entity.identifiers as any)?.geolocation||entity.identifiers,data)}</span></li>)}</ul>:<p>No evidence-backed coordinates have been recorded yet.</p>}<table><caption>Layer availability</caption><thead><tr><th>Layer</th><th>State</th><th>Source / requirement</th></tr></thead><tbody>{[['Basemap','Available','OpenStreetMap attribution retained'],['Case entities','Available when sourced','Current authorized case evidence; unknown locations stay listed'],['Vessels / AIS','Unavailable','No approved feed broker and licensed provider configured'],['Aircraft','Unavailable','No approved provider configured'],['Satellites / terrain / 3D tiles','Unavailable','Provider credentials and usage rights not configured'],['Road cameras / street imagery','Unavailable','Per-source terms and provider setup required'],['Historical / regional datasets','Excluded','Not imported as current CRM evidence; per-source licences differ']].map(([layer,state,reason])=><tr key={layer}><td>{layer}</td><td>{state}</td><td>{reason}</td></tr>)}</tbody></table></details>
 </section>;
}
