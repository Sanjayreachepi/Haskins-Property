import type { Request,Response,NextFunction } from "express";
import { consumeLimit, MemoryLimits } from "./rate-limit";

export function positiveInteger(name:string,fallback:number,maximum:number) {
  const value=Number(process.env[name]??fallback);
  if(!Number.isInteger(value)||value<1||value>maximum)throw Error(`Invalid ${name}`);
  return value;
}
/** Installed before JSON parsing, authentication, uploads, Redis/DB work and all route handlers. */
export function requestProtection(){
 const maxActive=positiveInteger("API_MAX_INFLIGHT",128,2048),maxPerIp=positiveInteger("API_MAX_INFLIGHT_PER_IP",16,128),maxUploads=positiveInteger("API_MAX_UPLOADS",2,16);
 let active=0,uploads=0;
 const perIp=new Map<string,number>(),burst=new MemoryLimits(10000);
 const origins=[process.env.WEB_ORIGIN||"http://localhost:3000",process.env.ADMIN_ORIGIN||"http://localhost:3001"];
 return (req:Request,res:Response,next:NextFunction)=>{
  res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","no-referrer");
  const reject=(status:number,message:string,retry=0)=>{if(retry)res.setHeader("Retry-After",String(retry));res.status(status).json({message});};
  const ip=req.ip||req.socket.remoteAddress||"unknown",path=req.path,write=!["GET","HEAD","OPTIONS"].includes(req.method);
  if(!["GET","HEAD","POST","PATCH","DELETE","OPTIONS","PUT"].includes(req.method)){reject(405,"Method not allowed.");return;}
  const admin=/^\/api\/admin(?:\/|$)/.test(path);
  if((admin&&req.headers.origin&&req.headers.origin!==origins[1])||(write&&!(admin?[origins[1]]:origins).includes(req.headers.origin||""))){reject(403,"Untrusted request origin");return;}
  // Bounds local state and prevents a flood from allocating unbounded Redis promises or DB tasks.
  try{if(!burst.consume(ip,60,1000).allowed){reject(429,"Too many requests.",1);return;}}catch{reject(503,"Service busy. Please try again shortly.",1);return;}
  if(active>=maxActive){reject(503,"Service busy. Please try again shortly.",1);return;}
  if((perIp.get(ip)||0)>=maxPerIp){reject(429,"Too many concurrent requests.",1);return;}
  const upload=req.method==="POST"&&/^\/api\/admin\/(media|tenant-documents)\/?$/.test(path);
  if(upload&&uploads>=maxUploads){reject(503,"Uploads busy. Please try again shortly.",1);return;}
  const length=Number(req.headers["content-length"]||0),maximum=upload?11*1024*1024:150*1024;
  if(length>maximum){reject(413,"Request body is too large.");return;}
  if(write&&(length>0||req.headers["transfer-encoding"])&&!/^application\/json(?:;|$)/i.test(req.headers["content-type"]||"")&&!(upload&&/^multipart\/form-data;/i.test(req.headers["content-type"]||""))){reject(415,"Unsupported request content type.");return;}
  active++;perIp.set(ip,(perIp.get(ip)||0)+1);if(upload)uploads++;
  let released=false;const release=()=>{if(released)return;released=true;active--;if(upload)uploads--;const n=(perIp.get(ip)||1)-1;if(n>0)perIp.set(ip,n);else perIp.delete(ip);};
  res.once("finish",release);res.once("close",release);
  const category=/^\/api\/(?:admin\/)?auth\//.test(path)?"auth":upload?"upload":write?"write":path==="/api/health"?"health":"read";
  const budgets={auth:90,upload:30,write:120,health:120,read:1200};
  consumeLimit(`request:${category}:${ip}`,budgets[category],60000).then(result=>{
   if(res.destroyed||res.writableEnded)return;
   res.setHeader("RateLimit-Limit",String(budgets[category]));res.setHeader("RateLimit-Remaining",String(result.remaining));res.setHeader("RateLimit-Reset",String(result.retryAfter));
   if(!result.allowed){reject(429,"Too many requests. Please try again later.",result.retryAfter);return;}
   next();
  }).catch(()=>{if(!res.destroyed&&!res.writableEnded)reject(503,"Service busy. Please try again shortly.",1);});
 };
}
