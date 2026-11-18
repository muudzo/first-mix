let promise;
function database() {
  if(!promise)promise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('first-mix',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('tracks',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{promise=null;reject(request.error);};
  });
  return promise;
}
export async function readTracks(){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('tracks').objectStore('tracks').getAll();req.onsuccess=()=>resolve(req.result.map(record=>{if(!record.audioData)return record;const {audioData,audioType,...track}=record;return {...track,blob:new Blob([audioData],{type:audioType||'application/octet-stream'})};}));req.onerror=()=>reject(req.error||new Error('Local tracks could not be read.'));});}
export async function saveTrack(track){
  // Raw bytes avoid WebKit's inconsistent persistence of large Blob/File objects.
  const {blob,...record}=track;
  if(blob){record.audioData=await blob.arrayBuffer();record.audioType=blob.type;}
  const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('This browser could not save the audio file.'));tx.onabort=()=>reject(tx.error||new Error('Storage write was interrupted.'));});
}
export async function deleteTrack(id){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export function readProgress(){try{const value=JSON.parse(localStorage.getItem('first-mix-progress')||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[];}catch{return [];}}
export function saveProgress(value){try{localStorage.setItem('first-mix-progress',JSON.stringify(value));return true;}catch{return false;}}
