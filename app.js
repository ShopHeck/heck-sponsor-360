const frameCount=12;
const frameNames=["FRONT","FRONT RIGHT","RIGHT","REAR RIGHT","REAR","BACK","REAR LEFT","LEFT","FRONT LEFT","FRONT LEFT","FRONT","FRONT"];
const quickViews={front:0,right:2,back:5,left:8};
const shirtWidth=[1,.85,.62,.72,1,1,.72,.62,.85,1,1,1];
const shortsWidth=[1,.9,.72,.8,.86,.86,.8,.72,.9,1,1,1];
const garmentShapes={
  shorts:[
    "M332 844 L566 844 L586 1125 L472 1121 L450 946 L428 1121 L310 1125 Z",
    "M348 844 L548 855 L574 1113 L470 1105 L443 943 L416 1101 L329 1084 Z",
    "M372 843 L515 859 L535 1087 L454 1081 L428 934 L397 1065 L346 1040 Z",
    "M354 841 L548 858 L568 1107 L462 1116 L440 946 L414 1110 L326 1088 Z",
    "M324 840 L564 838 L590 1117 L472 1113 L448 946 L424 1113 L300 1115 Z",
    "M318 840 L568 840 L592 1118 L470 1115 L446 946 L422 1115 L294 1118 Z",
    "M326 844 L552 843 L572 1106 L466 1111 L441 945 L416 1103 L309 1084 Z",
    "M360 846 L516 857 L536 1082 L459 1088 L432 935 L405 1068 L350 1047 Z",
    "M348 844 L548 855 L570 1107 L470 1101 L443 943 L416 1101 L326 1080 Z",
    "M330 844 L565 844 L584 1120 L470 1116 L448 946 L426 1116 L307 1122 Z",
    "M334 844 L565 844 L585 1124 L472 1120 L450 946 L428 1120 L312 1125 Z",
    "M332 844 L566 844 L586 1125 L472 1121 L450 946 L428 1121 L310 1125 Z"
  ],
  shirt:Array(12).fill("M376 660 Q450 700 524 660 L556 668 L602 762 L572 800 L536 782 L538 952 Q450 968 362 952 L364 782 L328 800 L298 762 L344 668 Z"),
};
const placements={
  shorts:{
    front:[
      {id:"SF-L1",name:"Front left · Upper",detail:"Prime camera-facing logo placement on the left leg.",x:330,y:880,w:105,h:58},
      {id:"SF-L2",name:"Front left · Center",detail:"Central placement with strong walkout and stance visibility.",x:330,y:950,w:105,h:58},
      {id:"SF-L3",name:"Front left · Lower",detail:"Lower-leg placement built for full-body photography.",x:330,y:1020,w:105,h:58},
      {id:"SF-R1",name:"Front right · Upper",detail:"Prime camera-facing logo placement on the right leg.",x:466,y:880,w:105,h:58},
      {id:"SF-R2",name:"Front right · Center",detail:"Central placement with strong walkout and stance visibility.",x:466,y:950,w:105,h:58},
      {id:"SF-R3",name:"Front right · Lower",detail:"Lower-leg placement built for full-body photography.",x:466,y:1020,w:105,h:58}
    ],
    back:[
      {id:"SB-L1",name:"Back left · Upper",detail:"Upper rear placement visible during introductions and corner shots.",x:324,y:880,w:108,h:58},
      {id:"SB-L2",name:"Back left · Center",detail:"Rear left placement for walkout and broadcast photography.",x:324,y:950,w:108,h:58},
      {id:"SB-L3",name:"Back left · Lower",detail:"Lower rear placement with clean separation from the waistband.",x:324,y:1020,w:108,h:58},
      {id:"SB-R1",name:"Back right · Upper",detail:"Upper rear placement visible during introductions and corner shots.",x:468,y:880,w:108,h:58},
      {id:"SB-R2",name:"Back right · Center",detail:"Rear right placement for walkout and broadcast photography.",x:468,y:950,w:108,h:58},
      {id:"SB-R3",name:"Back right · Lower",detail:"Lower rear placement with clean separation from the waistband.",x:468,y:1020,w:108,h:58}
    ]
  },
  shirt:{
    front:Array.from({length:12},(_,i)=>({id:`TF-${String(i+1).padStart(2,"0")}`,name:`Front grid · Row ${Math.floor(i/3)+1}, column ${i%3+1}`,detail:"Front walkout T-shirt placement in the 4 × 3 sponsor grid.",x:378+(i%3)*52,y:716+Math.floor(i/3)*56,w:46,h:48})),
    back:[{id:"TB-01",name:"Upper back · Shoulder blades",detail:"Wide statement placement across the upper back of the walkout T-shirt.",x:360,y:700,w:180,h:64}],
    sleeves:[
      {id:"TS-01",name:"Sleeve pair · Upper",detail:"Matching logo placement on both sleeves near the shoulder.",x:312,y:690,w:40,h:30,mirrorX:548},
      {id:"TS-02",name:"Sleeve pair · Center",detail:"Matching logo placement on both sleeves at mid-arm.",x:316,y:726,w:40,h:30,mirrorX:544},
      {id:"TS-03",name:"Sleeve pair · Lower",detail:"Matching logo placement on both sleeves above the cuff.",x:322,y:762,w:40,h:30,mirrorX:538}
    ]
  }
};

const state={frame:0,garment:"shorts",selected:"SF-L1",logos:{},dragX:0,dragStartFrame:0};
const frame=document.getElementById("athleteFrame");
const stage=document.getElementById("modelStage");
const garmentPath=document.getElementById("garmentPath");
const clipPath=document.getElementById("garmentClipPath");
const slotLayer=document.getElementById("slotLayer");
const inventoryList=document.getElementById("inventoryList");
const inventoryTitle=document.getElementById("inventoryTitle");
const selectionCode=document.getElementById("selectionCode");
const selectionName=document.getElementById("selectionName");
const selectionDescription=document.getElementById("selectionDescription");
const uploadLabel=document.getElementById("uploadLabel");

for(let i=0;i<frameCount;i++){const image=new Image();image.src=`assets/processed/heckert-${String(i).padStart(2,"0")}.webp`}

function currentSide(){if(state.frame<=1||state.frame>=9)return"front";if(state.frame>=4&&state.frame<=6)return"back";return state.frame<4?"right":"left"}
function visiblePlacements(){const side=currentSide();if(state.garment==="shorts")return placements.shorts[side]||[];if(side==="front")return[...placements.shirt.front,...placements.shirt.sleeves];if(side==="back")return placements.shirt.back;return placements.shirt.sleeves}
function allGarmentPlacements(){if(state.garment==="shorts")return[...placements.shorts.front,...placements.shorts.back];return[...placements.shirt.front,...placements.shirt.back,...placements.shirt.sleeves]}
function findPlacement(){return allGarmentPlacements().find(item=>item.id===state.selected)||allGarmentPlacements()[0]}
function createSvg(name,attrs={}){const node=document.createElementNS("http://www.w3.org/2000/svg",name);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));return node}
function renderSlots(){slotLayer.replaceChildren();const spots=visiblePlacements();spots.forEach(spot=>{const group=createSvg("g",{class:`slot${spot.id===state.selected?" is-selected":""}`,role:"button",tabindex:"0","aria-label":spot.name});const side=currentSide();const positions=spot.mirrorX!==undefined&&side!=="front"&&side!=="back"?[450-spot.w/2]:[spot.x,spot.mirrorX].filter(value=>value!==undefined);positions.forEach(x=>{const rect=createSvg("rect",{x,y:spot.y,width:spot.w,height:spot.h});group.append(rect);const logo=state.logos[spot.id];if(logo){const image=createSvg("image",{href:logo,x:x+5,y:spot.y+5,width:spot.w-10,height:spot.h-10,preserveAspectRatio:"xMidYMid meet"});group.append(image)}else{const text=createSvg("text",{x:x+spot.w/2,y:spot.y+spot.h/2});text.textContent=spot.id.replace(/^[A-Z]+-/,"");group.append(text)}if(x!==spot.x)rect.setAttribute("x",x)});group.addEventListener("click",()=>selectPlacement(spot.id));group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectPlacement(spot.id)}});slotLayer.append(group)})}
function renderInventory(){const side=currentSide();const viewLabel=side==="front"?"Front":side==="back"?"Back":state.garment==="shirt"?"Sleeves":"Side";inventoryTitle.textContent=`${state.garment==="shirt"?"Black T-shirt":"Fight shorts"} · ${viewLabel}`;const items=visiblePlacements();inventoryList.replaceChildren();if(!items.length){const empty=document.createElement("p");empty.className="intro-copy";empty.textContent="Rotate to the front or back to select a placement.";inventoryList.append(empty);return}items.forEach((spot,index)=>{const button=document.createElement("button");button.className=`inventory-item${spot.id===state.selected?" is-selected":""}`;button.innerHTML=`<span class="num">${String(index+1).padStart(2,"0")}</span><span><strong>${spot.name}</strong><small>${spot.id}</small></span><span class="status">OPEN</span>`;button.addEventListener("click",()=>selectPlacement(spot.id));inventoryList.append(button)})}
function renderSelection(){const spot=findPlacement();state.selected=spot.id;selectionCode.textContent=spot.id;selectionName.textContent=spot.name;selectionDescription.textContent=spot.detail;uploadLabel.textContent=state.logos[spot.id]?"Replace logo preview":"Upload logo preview"}
function render(){frame.src=`assets/processed/heckert-${String(state.frame).padStart(2,"0")}.webp`;frame.alt=`Michael Heckert, ${frameNames[state.frame].toLowerCase()} view in ${state.garment==="shirt"?"a black sponsorship T-shirt":"fight shorts"}`;const shape=garmentShapes[state.garment][state.frame];garmentPath.setAttribute("fill-rule","evenodd");clipPath.setAttribute("clip-rule","evenodd");garmentPath.setAttribute("d",shape);garmentPath.setAttribute("fill",state.garment==="shirt"?"url(#shirtFabric)":"url(#shortFabric)");clipPath.setAttribute("d",shape);const w=(state.garment==="shirt"?shirtWidth:shortsWidth)[state.frame];const garmentTransform=w===1?"":`translate(${450*(1-w)} 0) scale(${w} 1)`;garmentPath.setAttribute("fill-opacity",state.garment==="shirt"?"1":".94");garmentPath.setAttribute("transform",garmentTransform);clipPath.setAttribute("transform",garmentTransform);slotLayer.setAttribute("transform",state.garment==="shorts"?garmentTransform:"");document.getElementById("orientationLabel").textContent=frameNames[state.frame];document.getElementById("orientationNeedle").style.left=`${state.frame/(frameCount-1)*100}%`;renderSlots();renderInventory();renderSelection()}
function selectPlacement(id){state.selected=id;renderSlots();renderInventory();renderSelection()}
function setFrame(next){state.frame=(next+frameCount)%frameCount;const visible=visiblePlacements();if(visible.length&&!visible.some(item=>item.id===state.selected))state.selected=visible[0].id;render()}
function setGarment(garment){state.garment=garment;state.selected=garment==="shirt"?"TF-01":"SF-L1";document.querySelectorAll(".garment-tab").forEach(button=>{const active=button.dataset.garment===garment;button.classList.toggle("is-active",active);button.setAttribute("aria-selected",String(active))});if(currentSide()!=="front")setFrame(0);else render()}

document.querySelectorAll(".garment-tab").forEach(button=>button.addEventListener("click",()=>setGarment(button.dataset.garment)));
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>setFrame(quickViews[button.dataset.view])));
document.getElementById("rotatePrev").addEventListener("click",()=>setFrame(state.frame-1));
document.getElementById("rotateNext").addEventListener("click",()=>setFrame(state.frame+1));

stage.addEventListener("pointerdown",event=>{if(event.target.closest("button,.slot"))return;state.dragX=event.clientX;state.dragStartFrame=state.frame;stage.classList.add("is-dragging");stage.setPointerCapture(event.pointerId)});
stage.addEventListener("pointermove",event=>{if(!stage.classList.contains("is-dragging"))return;const delta=event.clientX-state.dragX;const frameDelta=Math.round(delta/32);setFrame(state.dragStartFrame-frameDelta)});
stage.addEventListener("pointerup",()=>stage.classList.remove("is-dragging"));
stage.addEventListener("pointercancel",()=>stage.classList.remove("is-dragging"));

document.getElementById("logoInput").addEventListener("change",event=>{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024){alert("Please choose a logo under 5 MB.");return}const old=state.logos[state.selected];if(old)URL.revokeObjectURL(old);state.logos[state.selected]=URL.createObjectURL(file);render()});
document.getElementById("reserveButton").addEventListener("click",()=>{const spot=findPlacement();const subject=encodeURIComponent(`BKFC Clearwater sponsorship inquiry: ${spot.id}`);const body=encodeURIComponent(`I am interested in ${spot.name} (${spot.id}) in the interactive sponsorship portal.`);window.open(`mailto:michaelheckert@heckholdings.com?subject=${subject}&body=${body}`,"_blank")});

const embedDialog=document.getElementById("embedDialog");document.getElementById("embedButton").addEventListener("click",()=>embedDialog.showModal());document.getElementById("dialogClose").addEventListener("click",()=>embedDialog.close());document.getElementById("copyEmbed").addEventListener("click",async()=>{await navigator.clipboard.writeText(document.getElementById("embedCode").textContent);document.getElementById("copyEmbed").textContent="Copied";setTimeout(()=>document.getElementById("copyEmbed").textContent="Copy embed code",1600)});

render();
